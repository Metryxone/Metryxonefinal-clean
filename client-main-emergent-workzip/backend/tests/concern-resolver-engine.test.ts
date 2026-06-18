// RRP-1 resolver engine tests — run: npx tsx tests/concern-resolver-engine.test.ts
import {
  buildResolverCorpus,
  resolveConcern,
  tokenizeIntent,
  expandResolverToken,
  type ConcernRowInput,
} from '../services/concern-resolver-engine';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

// ── Synthetic corpus mirroring the real master shape ─────────────────────────
const ROWS: ConcernRowInput[] = [
  { concern_id: 'C_CONF', display_label: 'Confidence', concern_cluster: 'Self-Belief', concern_category: 'emotional', domain: 'wellbeing', relational_bridge_tag: 'SELF_CONFIDENCE', primary_persona: 'campus_student', age_min: 14, age_max: 24 },
  { concern_id: 'C_CONF_LEAD', display_label: 'Leadership Confidence', concern_cluster: 'Leadership', concern_category: 'professional', domain: 'work', relational_bridge_tag: 'LEADERSHIP', primary_persona: 'mid_career_professional', age_min: 24, age_max: 45 },
  { concern_id: 'C_MOTIV', display_label: 'Motivation', concern_cluster: 'Drive', concern_category: 'behavioural', domain: 'self', relational_bridge_tag: 'MOTIVATION', primary_persona: 'campus_student', age_min: 14, age_max: 24 },
  { concern_id: 'C_EXAM', display_label: 'Exam Stress', concern_cluster: 'Academic Pressure', concern_category: 'academic', domain: 'academic', relational_bridge_tag: 'EXAMINATION_STRESS', primary_persona: 'campus_student', age_min: 14, age_max: 18 },
  { concern_id: 'C_WORKSTRESS', display_label: 'Workplace Stress', concern_cluster: 'Work Pressure', concern_category: 'professional', domain: 'work', relational_bridge_tag: 'WORK_STRESS', primary_persona: 'mid_career_professional', age_min: 24, age_max: 60 },
  // many generic "stress" rows to verify IDF de-weights the common token
  ...Array.from({ length: 30 }, (_, i) => ({
    concern_id: `C_GEN_${i}`, display_label: `General Stress Variant ${i}`, concern_cluster: 'Wellbeing',
    concern_category: 'emotional', domain: 'general', relational_bridge_tag: 'GENERAL_CONCERN',
    primary_persona: 'campus_student', age_min: 6, age_max: 60,
  })),
];
const corpus = buildResolverCorpus(ROWS);

console.log('tokenize + expand');
ok('tokenizes, drops stopwords', JSON.stringify(tokenizeIntent('I have trouble with my confidence')) === JSON.stringify(['trouble', 'confidence']), tokenizeIntent('I have trouble with my confidence'));
ok('empty text → []', tokenizeIntent('').length === 0);
ok('expand returns own stem + synonyms', expandResolverToken('stressed').patterns.includes('anxiet'));

console.log('short-intent mode (Phase 3) — no 60% gate');
const conf = resolveConcern(corpus, 'confidence', null, null);
ok('"confidence" resolves (1 token, no gate)', conf.concern_id === 'C_CONF', conf);
ok('short_intent flag set', conf.short_intent === true);
const motiv = resolveConcern(corpus, 'motivation', null, null);
ok('"motivation" resolves', motiv.concern_id === 'C_MOTIV', motiv.concern_id);
const trouble = resolveConcern(corpus, 'i have trouble with confidence', null, null);
ok('"i have trouble with confidence" → Confidence (was a 444-tie failure)', trouble.concern_id === 'C_CONF', trouble);

console.log('tie-break cascade (Phase 1) — exact label beats alphabetical id');
// both Confidence + Leadership Confidence match "confidence"; exact-label of the
// bare "Confidence" should win when scores tie, NOT alphabetical concern_id.
const tie = resolveConcern(corpus, 'confidence', null, null);
ok('exact-label wins tie (not concern_id ASC)', tie.concern_id === 'C_CONF');
ok('tie_break_reason is explainable', typeof tie.tie_break_reason === 'string' && tie.tie_break_reason.length > 0, tie.tie_break_reason);

console.log('IDF / rarity weighting (Phase 2)');
// "stress" is common (30+ rows); "exam" is rare. "exam stress" must land on Exam
// Stress, not a generic stress variant.
const exam = resolveConcern(corpus, 'exam stress', ['campus_student'], [14, 18]);
ok('rare token (exam) outranks common (stress)', exam.concern_id === 'C_EXAM', exam.concern_id);
const stemS = corpus.idf.get('stres') ?? 99; // "stress" → stem "stres"
const stemE = corpus.idf.get('exam') ?? -99;
ok('idf(exam) > idf(stress)', stemE > stemS, { stemE, stemS });

console.log('persona cohort + age tiebreak');
const ws = resolveConcern(corpus, 'stress at work', ['mid_career_professional'], [24, 45]);
ok('professional cohort → workplace stress', ws.concern_id === 'C_WORKSTRESS', ws.concern_id);

console.log('confidence scoring (Phase 6)');
ok('confidence 0-100', conf.confidence >= 0 && conf.confidence <= 100, conf.confidence);
ok('exact-label high confidence', conf.confidence >= 40, conf.confidence);
ok('components present', conf.components && typeof conf.components.tie_margin === 'number');
const off = resolveConcern(corpus, 'photosynthesis chlorophyll mitochondria xylophone', null, null);
ok('off-topic long intent → no resolve (≥60 gate holds)', off.concern_id === null, off);

console.log('determinism + never-throws');
const a = resolveConcern(corpus, 'exam stress confidence', ['campus_student'], [14, 18]);
const b = resolveConcern(corpus, 'exam stress confidence', ['campus_student'], [14, 18]);
ok('deterministic', a.concern_id === b.concern_id && a.confidence === b.confidence);
let threw = false;
try { resolveConcern(corpus, '', null, null); resolveConcern(corpus, '!!!', null, null); resolveConcern(buildResolverCorpus([]), 'x y', null, null); }
catch { threw = true; }
ok('never throws on empty/garbage', threw === false);

console.log('degenerate corpus (0 / 1 row) → finite, deterministic confidence');
const c0 = buildResolverCorpus([]);
const r0 = resolveConcern(c0, 'anything here', null, null);
ok('empty corpus → null, finite confidence', r0.concern_id === null && Number.isFinite(r0.confidence));
const c1 = buildResolverCorpus([
  { concern_id: 'ONLY', display_label: 'Exam Stress', concern_cluster: 'Exam Stress', concern_category: null, common_indian_context: null, domain: null, relational_bridge_tag: 'EXAM', primary_persona: null, age_min: null, age_max: null },
]);
const r1a = resolveConcern(c1, 'exam stress', null, null);
const r1b = resolveConcern(c1, 'exam stress', null, null);
ok('1-row corpus → finite confidence (no NaN/Infinity)', Number.isFinite(r1a.confidence) && r1a.confidence >= 0 && r1a.confidence <= 100, r1a.confidence);
ok('1-row corpus deterministic', r1a.concern_id === r1b.concern_id && r1a.confidence === r1b.confidence);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
