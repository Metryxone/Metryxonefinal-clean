/*
 * CAPADEX Question Intelligence Layer — Phase 1 Audit (DISCOVERY ONLY, READ-ONLY).
 *
 * Performs a complete diagnostic audit of the curated clarity-question bank and its
 * concern/signal taxonomy. Makes ZERO writes to the database and changes NO production
 * behaviour. Emits an audit dataset, per-question + per-option quality scores, ranked
 * issue reports, and a remediation roadmap to audit/phase1/.
 *
 * Scoring is deterministic heuristic (no LLM) so the full 14k-row bank can be scored
 * reproducibly and for free. Heuristic formulas are documented in REMEDIATION_REPORT.md
 * and the limitation (heuristic != human/LLM judgement) is called out in the roadmap.
 *
 * Run:  cd backend && node scripts/audit/question-intelligence-audit.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve(process.cwd(), '..', 'audit', 'phase1');

// ───────────────────────── helpers ─────────────────────────
const STOP = new Set(('a an the of to in on for and or your you yours yourself do does did how when while ' +
  'if is are was were this that with about it as at be been being i my me mine we our us they them their ' +
  'he she his her not no yes so than then too very can could would should will shall may might just ' +
  'how often how much how many feel feels feeling get got have has had into out up down over more most ' +
  'some any all both each few other such own same now also like really actually personally inside these those ' +
  'there here what which who whom whose because but however').split(/\s+/));

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const collapse = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => collapse(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const tokenSet = (s) => new Set(tokens(s));
const jaccard = (a, b) => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function writeCsv(file, headers, rows) {
  const out = [headers.join(',')];
  for (const r of rows) out.push(headers.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(path.join(OUT_DIR, file), out.join('\n'));
  return rows.length;
}

// persona macro-grouping
function personaGroup(p) {
  const s = norm(p);
  if (!s) return 'generic';
  if (s.includes('parent')) return 'parent';
  if (/(teacher|educator|principal|academic|faculty)/.test(s)) return 'educator';
  if (/(student|campus|learner|aspirant|school)/.test(s)) return 'student';
  if (/(job seeker|jobseeker|placement)/.test(s)) return 'jobseeker';
  if (/(professional|employee|leadership track|mid-career|working|early career professional|career transition|manager)/.test(s)) return 'professional';
  if (/(counsellor|counselor|mentor|coach|cell|office|success|operations|reflection)/.test(s)) return 'counsellor';
  return 'generic';
}
// macro domains for cross-context conflict detection
const EDU_GROUPS = new Set(['student', 'educator', 'parent']);
const WORK_GROUPS = new Set(['professional', 'jobseeker']);

const PERSONA_LEX = {
  student: ['school', 'class', 'classroom', 'homework', 'exam', 'exams', 'marks', 'syllabus', 'college', 'semester', 'tuition', 'study', 'studying', 'lecture', 'assignment', 'grades'],
  educator: ['students', 'classroom', 'teaching', 'lesson', 'curriculum', 'pupils', 'lecture'],
  parent: ['child', 'son', 'daughter', 'kid', 'kids', 'parenting'],
  professional: ['workplace', 'office', 'manager', 'boss', 'colleague', 'colleagues', 'deadline', 'deadlines', 'project', 'meeting', 'meetings', 'appraisal', 'promotion', 'kpi', 'workload', 'team', 'client', 'clients', 'job', 'work'],
  jobseeker: ['interview', 'interviews', 'recruiter', 'resume', 'hiring', 'application', 'applications', 'offer'],
};
const INDUSTRY_LEX = ['software', 'coding', 'engineer', 'engineering', 'sales', 'quota', 'medical', 'hospital', 'patient', 'patients', 'clinic', 'legal', 'lawyer', 'finance', 'banking', 'trading', 'retail', 'factory', 'manufacturing', 'startup', 'founder', 'marketing', 'hr', 'logistics', 'construction', 'teacher', 'classroom', 'restaurant', 'hospitality', 'agriculture', 'farming'];
const VAGUE = ['thing', 'things', 'stuff', 'etc', 'somehow', 'kind of', 'sort of', 'whatever', 'anything', 'something'];

// ── runtime bridge-tag resolution (MIRRORS production `resolveCoveredBridgeTag`
//    in backend/routes/capadex-concern-intelligence.ts). At runtime EVERY orphan
//    bridge tag is remapped to a COVERED bucket (GENERAL_CONCERN at worst) — so a
//    concern almost never hits *static* fallback; instead it loses concern-specific
//    curation and inherits another bucket's questions. This audit reproduces that
//    resolution against the LIVE covered set (`coveredSet`, derived from which tags
//    actually carry curated questions) rather than hardcoding the 56 tags. ──
const ORPHAN_BRIDGE_TAG_FALLBACK = {
  CAREER_TRANSITION: 'CAREER_GROWTH', EXAMINATION_READINESS: 'EXAMINATION_STRESS',
  COLLABORATION_OWNERSHIP: 'LEADERSHIP_OWNERSHIP', STRATEGIC_LEADERSHIP: 'ADAPTIVE_LEADERSHIP',
  ADAPTIVE_LEARNING: 'LEARNING_ADAPTABILITY', INTERDISCIPLINARY_LEARNING: 'LEARNING_ADAPTABILITY',
  WORKPLACE_PERFORMANCE: 'WORKPLACE_ADAPTATION', ACADEMIC_PERFORMANCE: 'ACADEMIC_COGNITIVE',
  HELP_SEEKING: 'ADJUSTMENT_COPING', INQUIRY_CURIOSITY: 'THINKING_QUALITY',
};
const BRIDGE_TAG_KEYWORD_RULES = [
  [/EXAM|EXAMINATION/, 'EXAMINATION_STRESS'], [/EMPLOY/, 'EMPLOYABILITY'],
  [/FACULTY|TEACHING|INSTRUCTION|PEDAGOG/, 'INSTRUCTIONAL_QUALITY'], [/CLASSROOM/, 'CLASSROOM_ENGAGEMENT'],
  [/LEADERSHIP|MANAGEMENT|TEAM|COLLABORAT|STRATEGIC|ORGANI[SZ]ATION|STAKEHOLDER/, 'LEADERSHIP_OWNERSHIP'],
  [/WORKPLACE|WORKFORCE|PLACEMENT/, 'WORKPLACE_ADAPTATION'],
  [/ANXIETY|STRESS|EMOTION|WELLNESS|WELLBEING|RECOVERY|STABILITY|MATURITY/, 'EMOTIONAL_REGULATION'],
  [/VOCATION|ENTREPRENEUR|INNOVATION/, 'CAREER_READINESS'], [/CAREER/, 'CAREER_READINESS'],
  [/INQUIRY|CURIOSITY|ANALYTIC|THINKING|PROBLEM|DECISION|REFLECT/, 'THINKING_QUALITY'],
  [/ACADEMIC|SUBJECT|STEM|STUDY/, 'ACADEMIC_COGNITIVE'], [/LEARNING|LEARNER/, 'LEARNING_ADAPTABILITY'],
  [/SKILL|COMPETENC|CAPABILIT|TALENT|POTENTIAL|STRENGTH/, 'COMPETENCY_DEVELOPMENT'],
  [/COMMUNICAT|EXPRESSION/, 'COMMUNICATION_EXPRESSION'], [/SOCIAL|PEER|RELATIONSHIP|PARENT/, 'SOCIAL_EMOTIONAL'],
  [/MOTIVAT|PURPOSE|GOAL|ASPIRATION|VISION|PERSEVERANCE|GRIT/, 'MOTIVATION_VALUES'],
  [/DISCIPLINE|HABIT|PRODUCTIVITY|ROUTINE|DIGITAL|TIME/, 'DISCIPLINE_HABITS'],
  [/CONFIDENCE/, 'CONFIDENCE_SELF'], [/PERSONALITY|IDENTITY|SELF/, 'SELF_PERCEPTION'],
  [/STUDENT/, 'STUDENT_SUCCESS'], [/TRANSITION|CHANGE/, 'TRANSITION_READINESS'],
  [/DEVELOPMENT|GROWTH/, 'HOLISTIC_DEVELOPMENT'], [/COPING|ADJUSTMENT/, 'ADJUSTMENT_COPING'],
  [/LIFESTYLE|SUSTAINABILITY|BALANCE/, 'LIFESTYLE_PRESSURE'],
];
const GENERAL_FALLBACK_TAG = 'GENERAL_CONCERN';
// Returns {target, route} where route ∈ covered_self | override | keyword | general | static_fallback.
// `coveredSet` holds UPPER-cased bridge tags that actually carry curated questions.
function resolveCoveredBridgeTag(tag, coveredSet) {
  const up = String(tag || '').toUpperCase().trim();
  if (!up) return { target: null, route: 'static_fallback' };
  if (coveredSet.has(up)) return { target: up, route: 'covered_self' };
  const override = ORPHAN_BRIDGE_TAG_FALLBACK[up];
  if (override && coveredSet.has(override)) return { target: override, route: 'override' };
  for (const [re, target] of BRIDGE_TAG_KEYWORD_RULES) {
    if (re.test(up) && coveredSet.has(target)) return { target, route: 'keyword' };
  }
  if (coveredSet.has(GENERAL_FALLBACK_TAG)) return { target: GENERAL_FALLBACK_TAG, route: 'general' };
  return { target: null, route: 'static_fallback' };
}

// ───────────────────────── main ─────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Loading tables (read-only)…');

  const [cq, cm, sig, atom, adapt] = await Promise.all([
    pool.query(`SELECT id, question_id, concern_id, concern_id_prefix, master_bridge_tag, concern, stage,
                       question_type, narrative_style, question, response_type,
                       option_a, option_b, option_c, option_d, option_e,
                       option_a_score, option_b_score, option_c_score, option_d_score, option_e_score,
                       polarity, reverse_score, question_weight, low_score_anchor, high_score_anchor
                FROM capadex_clarity_questions`),
    pool.query(`SELECT concern_id, domain, concern_cluster, concern_category, severity, capadex_priority,
                       primary_persona, intelligence_layer, signal_cluster, assessment_dimension,
                       root_cause_group, intervention_lens, capability_mapping, relational_bridge_tag,
                       age_min, age_max, display_label
                FROM capadex_concerns_master`),
    pool.query(`SELECT signal_name, domain, signal_family, category, relational_bridge_tag FROM capadex_signals`),
    pool.query(`SELECT relational_bridge_tag, domain_name, family_name FROM capadex_atomic_signals`),
    pool.query(`SELECT concern_bucket, persona, age_min, age_max FROM adaptive_question_bank`),
  ]);

  const clarity = cq.rows;
  const concerns = cm.rows;
  console.log(`  clarity=${clarity.length} concerns=${concerns.length} signals=${sig.rows.length} atomic=${atom.rows.length} adaptive=${adapt.rows.length}`);

  // indexes
  const concernByBridge = new Map(); // lower(bridge) -> [concern rows]
  for (const c of concerns) {
    const b = norm(c.relational_bridge_tag);
    if (b) {
      if (!concernByBridge.has(b)) concernByBridge.set(b, []);
      concernByBridge.get(b).push(c);
    }
  }
  // signal bridge coverage set
  const signalBridge = new Set();
  for (const s of sig.rows) if (norm(s.relational_bridge_tag)) signalBridge.add(norm(s.relational_bridge_tag));
  for (const a of atom.rows) if (norm(a.relational_bridge_tag)) signalBridge.add(norm(a.relational_bridge_tag));
  const adaptiveBuckets = new Set(adapt.rows.map((r) => norm(r.concern_bucket)).filter(Boolean));

  // bridge tags that have curated clarity coverage
  const clarityBridge = new Set();
  for (const q of clarity) if (norm(q.master_bridge_tag)) clarityBridge.add(norm(q.master_bridge_tag));
  // UPPER-cased covered set for runtime-faithful resolveCoveredBridgeTag()
  const coveredUpper = new Set([...clarityBridge].map((b) => b.toUpperCase()));

  // count question reuse of identical stems (for personalization templating penalty)
  const stemCount = new Map();
  for (const q of clarity) {
    const k = collapse(q.question);
    stemCount.set(k, (stemCount.get(k) || 0) + 1);
  }

  // Bridge tag is the AUTHORITATIVE join key. Clarity `concern_id` (e.g. RECALL_001) is a
  // question-set id, NOT a master concern_id — only 3/14294 resolve against the master table —
  // so per-question concern metadata is derived from a deterministic profile of the bridge
  // bucket (modal persona/cluster/domain + macro set), never an arbitrary single concern row.
  const modalOrig = (arr) => {
    const m = new Map();
    for (const x of arr) { const k = String(x ?? '').trim(); if (!k) continue; m.set(k, (m.get(k) || 0) + 1); }
    let best = '', bc = -1;
    for (const [k, c] of m) if (c > bc) { bc = c; best = k; }
    return best;
  };
  const macroOf = (g) => (EDU_GROUPS.has(g) ? 'edu' : WORK_GROUPS.has(g) ? 'work' : 'other');
  const bucketProfile = new Map();
  for (const [b, rows] of concernByBridge) {
    const personas = rows.map((r) => r.primary_persona).filter(Boolean);
    const macros = new Set(rows.map((r) => macroOf(personaGroup(r.primary_persona))));
    const modalDomain = modalOrig(rows.map((r) => r.domain));
    const modalCluster = modalOrig(rows.map((r) => r.concern_cluster));
    const modalDim = modalOrig(rows.map((r) => r.assessment_dimension));
    const modalLabel = modalOrig(rows.map((r) => r.display_label));
    const ages = rows.filter((r) => r.age_min != null || r.age_max != null);
    bucketProfile.set(b, {
      macros,
      modalPersona: modalOrig(personas),
      modalCluster, modalDomain, modalLabel,
      conceptTokens: tokenSet([b.replace(/_/g, ' '), modalDomain, modalCluster, modalDim, modalLabel].join(' ')),
      ageMin: ages.length ? Math.min(...ages.map((r) => r.age_min ?? 99)) : null,
      ageMax: ages.length ? Math.max(...ages.map((r) => r.age_max ?? 0)) : null,
      hasRootCause: rows.some((r) => norm(r.root_cause_group)),
      hasInterventionLens: rows.some((r) => norm(r.intervention_lens)),
      signalMapped: signalBridge.has(b),
      concernCount: rows.length,
    });
  }

  // ── per-question scoring + dataset ──
  const dataset = [];
  const qScores = [];
  const oScores = [];
  const proxyIssues = [];
  const personaMismatches = [];
  const industryHits = [];
  const responseTypeMismatches = [];
  const malformed = [];

  for (const q of clarity) {
    const text = String(q.question ?? '');
    const tset = tokenSet(text);
    const bridge = norm(q.master_bridge_tag);
    const bp = bucketProfile.get(bridge) || null;

    // concept vocabulary for relevance — bucket profile (bridge-authoritative) + question's own
    // authored concern label, NOT an arbitrary single concern row from a 181-deep bucket.
    const cset = new Set(bp ? bp.conceptTokens : []);
    for (const t of tokenSet(q.concern)) cset.add(t);
    let overlap = 0;
    for (const t of tset) if (cset.has(t)) overlap++;

    const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].map((o) => String(o ?? '').trim());
    const scores = [q.option_a_score, q.option_b_score, q.option_c_score, q.option_d_score, q.option_e_score];
    const nonEmpty = opts.filter((o) => o !== '');
    const presentScores = scores.filter((s) => s !== null && s !== undefined);
    const distinctScoreLevels = new Set(presentScores).size;
    const scoreRange = presentScores.length ? Math.max(...presentScores) - Math.min(...presentScores) : 0;
    const distinctOpts = new Set(nonEmpty.map((o) => collapse(o))).size;

    const words = collapse(text).split(' ').filter(Boolean);
    const wordCount = words.length;
    const has2nd = /\b(you|your|yours|yourself)\b/i.test(text);
    const has1st = /\b(i|my|me|mine|myself|we|our)\b/i.test(text);
    const lower = text.toLowerCase();

    // RELEVANCE
    let relevance = overlap >= 3 ? 92 : overlap === 2 ? 78 : overlap === 1 ? 60 : 35;
    if (has2nd) relevance += 6;
    relevance = clamp(relevance);

    // GRAMMAR
    let grammar = 100;
    if (!/[?]\s*$/.test(text)) grammar -= 15;
    if (/ {2,}/.test(text)) grammar -= 5;
    if (text !== text.trim()) grammar -= 5;
    if (/[(][^)]*$|^[^(]*[)]/.test(text)) grammar -= 5;
    if (/(\b\w+\b) \1\b/i.test(collapse(text))) grammar -= 10; // repeated word
    if (/\b(does|is|was|has)\s+\w+\s+(feels|does|likes|wants|finds|seems|knows|gets|makes)\b/i.test(text)) grammar -= 18; // broken 3rd-person conj
    if (/[?].*[?]/.test(text)) grammar -= 6;
    if (wordCount > 0 && !/^[A-Z0-9"']/.test(text.trim())) grammar -= 8; // not capitalised
    if (wordCount > 45) grammar -= 10;
    grammar = clamp(grammar);

    // SOPHISTICATION
    const uniqRatio = words.length ? new Set(words).size / words.length : 0;
    let soph = 0;
    soph += wordCount >= 8 && wordCount <= 28 ? 40 : wordCount >= 5 && wordCount <= 36 ? 26 : 10;
    soph += uniqRatio >= 0.8 ? 25 : uniqRatio >= 0.65 ? 16 : 8;
    soph += /[,;]/.test(text) ? 15 : 5; // subordinate/context clause
    soph += tset.size >= 4 ? 20 : tset.size >= 2 ? 12 : 4; // content richness
    if (VAGUE.some((v) => lower.includes(v))) soph -= 15;
    soph = clamp(soph);

    // PERSONALIZATION
    let personal = 0;
    if (has2nd) personal += 45;
    if (/\b(when|while|if|imagine|looking at|after|before|during)\b/i.test(text)) personal += 20;
    if (/\b(situation|moment|recently|these days|lately|day to day|at work|at school|at home)\b/i.test(text)) personal += 15;
    const reuse = stemCount.get(collapse(text)) || 1;
    if (reuse >= 5) personal -= 25; else if (reuse >= 2) personal -= 10;
    if (!has2nd && /\b(people|one|someone|individuals)\b/i.test(text)) personal -= 10;
    personal = clamp(personal + 20);

    // INFORMATION GAIN
    const nOpt = Math.max(nonEmpty.length, 1);
    let infogain = 0;
    infogain += distinctScoreLevels >= 5 ? 55 : distinctScoreLevels >= 4 ? 45 : distinctScoreLevels >= 3 ? 33 : distinctScoreLevels >= 2 ? 18 : 2;
    infogain += scoreRange >= 4 ? 25 : scoreRange >= 2 ? 14 : 4;
    infogain += nonEmpty.length >= 5 ? 20 : nonEmpty.length >= 3 ? 12 : 2;
    infogain = clamp(infogain);

    // ROOT CAUSE UTILITY
    let rootUtil = 0;
    if (bp?.hasRootCause) rootUtil += 30;
    if (bp?.hasInterventionLens) rootUtil += 18;
    if (bp?.signalMapped) rootUtil += 22;
    if (['behavior', 'behavioral', 'coping', 'cognitive', 'situational', 'social-contextual', 'integration'].includes(norm(q.question_type))) rootUtil += 15;
    if (/\b(why|what makes|what happens|leads to|because|tends to|usually)\b/i.test(text)) rootUtil += 12;
    rootUtil = clamp(rootUtil + 5);

    const qComposite = round(mean([relevance, grammar, soph, personal, infogain, rootUtil]));

    // ── OPTION QUALITY ──
    const monotonic = (() => {
      const s = presentScores;
      if (s.length < 2) return false;
      let inc = true, dec = true;
      for (let i = 1; i < s.length; i++) { if (s[i] < s[i - 1]) inc = false; if (s[i] > s[i - 1]) dec = false; }
      return inc || dec;
    })();
    const distinctiveness = clamp((distinctOpts / nOpt) * 100);
    const diagnosticPower = clamp(((distinctScoreLevels - 1) / Math.max(nOpt - 1, 1)) * 100);
    let signalValue = 0;
    if (norm(q.low_score_anchor) && norm(q.high_score_anchor)) signalValue += 35;
    signalValue += scoreRange >= 4 ? 35 : scoreRange >= 2 ? 18 : 4;
    if (monotonic) signalValue += 30;
    signalValue = clamp(signalValue);
    const avgOptWords = mean(nonEmpty.map((o) => collapse(o).split(' ').filter(Boolean).length));
    let readability = 0;
    readability += nonEmpty.length >= 2 ? 40 : 0;
    readability += avgOptWords >= 1 && avgOptWords <= 6 ? 35 : avgOptWords <= 9 ? 18 : 4;
    readability += nonEmpty.every((o) => o.length <= 60) ? 25 : 8;
    readability = clamp(readability);
    let realism = 0;
    const optBlob = norm(nonEmpty.join(' '));
    const isBareYesNo = nonEmpty.length <= 2 && /\byes\b/.test(optBlob) && /\bno\b/.test(optBlob);
    realism += nonEmpty.length >= 5 ? 40 : nonEmpty.length >= 3 ? 25 : 8;
    realism += /(never|rarely|sometimes|often|always|daily|weekly|hardly|frequently|low|high|mild|severe|not like me|exactly like me|easy|difficult)/.test(optBlob) ? 35 : 12;
    realism += monotonic ? 25 : 8;
    if (isBareYesNo) realism -= 30;
    realism = clamp(realism);
    const oComposite = round(mean([distinctiveness, diagnosticPower, signalValue, readability, realism]));

    // ── issue detections (collected here, ranked later) ──
    // proxy-language
    const proxyReasons = [];
    if (has1st) proxyReasons.push('first-person pronoun (breaks proxy/learner reframe)');
    if (!has2nd) proxyReasons.push('no 2nd-person pronoun (nothing to reframe to 3rd person)');
    if (/\b(do|are|have|were|was)\s+you\s+\w+ing\b/i.test(text) === false && /\byou\b/i.test(text) && /\b(yourself)\b/i.test(text)) proxyReasons.push('reflexive "yourself" — proxy reframe leaves dangling reflexive');
    if (proxyReasons.length) proxyIssues.push({ q, score: proxyReasons.length, reasons: proxyReasons.join('; ') });

    // persona mismatch — flag only when the question's macro context (edu vs work) is ABSENT
    // from the bridge bucket's persona macro set (buckets that span both never false-positive).
    const detected = {};
    for (const [grp, lex] of Object.entries(PERSONA_LEX)) {
      detected[grp] = lex.reduce((n, w) => n + (new RegExp(`\\b${w}\\b`, 'i').test(text) ? 1 : 0), 0);
    }
    const qGrp = Object.entries(detected).sort((a, b) => b[1] - a[1])[0];
    if (qGrp && qGrp[1] >= 2 && bp) {
      const qMacro = EDU_GROUPS.has(qGrp[0]) ? 'edu' : WORK_GROUPS.has(qGrp[0]) ? 'work' : 'other';
      if (qMacro !== 'other' && !bp.macros.has(qMacro) && (bp.macros.has('edu') || bp.macros.has('work'))) {
        personaMismatches.push({ q, qGroup: qGrp[0], qHits: qGrp[1], concernPersona: bp.modalPersona, concernGroup: [...bp.macros].filter((m) => m !== 'other').join('|') });
      }
    }

    // industry-specific jargon
    const indHits = INDUSTRY_LEX.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
    if (indHits.length) industryHits.push({ q, concernPersona: bp?.modalPersona || '', hits: indHits.length, terms: indHits.join('|') });

    // response-type mismatch
    const rtReasons = [];
    if (nonEmpty.length < 2) rtReasons.push(`response_type=${q.response_type} but <2 options`);
    if (distinctScoreLevels < 2) rtReasons.push('no score gradation (all option scores identical)');
    if (!monotonic && presentScores.length >= 3) rtReasons.push('option scores not monotonic with anchors');
    const rt = norm(q.response_type);
    const freqLike = /freq|how often/.test(rt);
    if (freqLike && !/(never|rarely|sometimes|often|always|daily|weekly|monthly|hardly)/.test(optBlob) && nonEmpty.length >= 2) rtReasons.push('frequency scale but options not frequency-worded');
    if (rtReasons.length) responseTypeMismatches.push({ q, reasons: rtReasons.join('; ') });

    // malformed (degenerate) question text
    if (wordCount < 2) malformed.push(q.question_id || String(q.id));

    const row = {
      concern_id: q.concern_id || '',
      concern_name: q.concern || bp?.modalLabel || '',
      concern_family: bp?.modalCluster || bp?.modalDomain || '',
      bridge_tag: q.master_bridge_tag || '',
      question_id: q.question_id || String(q.id),
      question_text: text,
      response_type: q.response_type || '',
      options: nonEmpty.join(' | '),
      persona: bp?.modalPersona || '',
      age_group: bp ? `${bp.ageMin ?? ''}-${bp.ageMax ?? ''}` : '',
      industry: '', // not modelled in schema — see report
      weight: q.question_weight ?? '',
    };
    dataset.push(row);
    qScores.push({ question_id: row.question_id, concern_id: row.concern_id, bridge_tag: row.bridge_tag,
      relevance, grammar, sophistication: soph, personalization: personal, information_gain: infogain,
      root_cause_utility: rootUtil, composite: qComposite, question_text: text });
    oScores.push({ question_id: row.question_id, concern_id: row.concern_id, response_type: row.response_type,
      distinctiveness, diagnostic_power: diagnosticPower, signal_value: signalValue, human_readability: readability,
      behavioral_realism: realism, composite: oComposite, options: row.options });
  }

  // ── duplicates (exact) ──
  const byStem = new Map();
  for (let i = 0; i < clarity.length; i++) {
    const k = collapse(clarity[i].question);
    if (!byStem.has(k)) byStem.set(k, []);
    byStem.get(k).push(i);
  }
  const exactDups = [];
  for (const [k, idxs] of byStem) {
    if (idxs.length > 1 && k) {
      for (let j = 1; j < idxs.length; j++) {
        exactDups.push({
          kind: 'exact', similarity: 1,
          question_id_a: clarity[idxs[0]].question_id, bridge_a: clarity[idxs[0]].master_bridge_tag,
          question_id_b: clarity[idxs[j]].question_id, bridge_b: clarity[idxs[j]].master_bridge_tag,
          question_text: clarity[idxs[0]].question,
        });
      }
    }
  }

  // ── duplicates (semantic, within bridge bucket via inverted index) ──
  const semDups = [];
  const byBridgeIdx = new Map();
  for (let i = 0; i < clarity.length; i++) {
    const b = norm(clarity[i].master_bridge_tag);
    if (!byBridgeIdx.has(b)) byBridgeIdx.set(b, []);
    byBridgeIdx.get(b).push(i);
  }
  const seenPair = new Set();
  for (const [, idxs] of byBridgeIdx) {
    const inv = new Map(); // token -> [idx]
    const sets = new Map();
    for (const i of idxs) { const ts = tokenSet(clarity[i].question); sets.set(i, ts); for (const t of ts) { if (!inv.has(t)) inv.set(t, []); inv.get(t).push(i); } }
    for (const i of idxs) {
      const ts = sets.get(i);
      const cand = new Set();
      for (const t of ts) { const list = inv.get(t) || []; if (list.length > 400) continue; for (const j of list) if (j > i) cand.add(j); }
      for (const j of cand) {
        const sim = jaccard(ts, sets.get(j));
        if (sim >= 0.82 && sim < 1) {
          const key = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (seenPair.has(key)) continue;
          seenPair.add(key);
          semDups.push({ kind: 'semantic', similarity: Number(sim.toFixed(3)),
            question_id_a: clarity[i].question_id, bridge_a: clarity[i].master_bridge_tag,
            question_id_b: clarity[j].question_id, bridge_b: clarity[j].master_bridge_tag,
            question_text: clarity[i].question, question_text_b: clarity[j].question });
        }
      }
    }
  }

  // ── bridge-tag leakage / coverage ──
  const bridgeIssues = [];
  for (const c of concerns) {
    const b = norm(c.relational_bridge_tag);
    if (!b) { bridgeIssues.push({ issue: 'concern has empty bridge_tag', concern_id: c.concern_id, concern: c.display_label, bridge_tag: '', curated_questions: 0 }); continue; }
    if (!clarityBridge.has(b)) {
      bridgeIssues.push({ issue: 'concern bridge_tag has NO curated questions (leak to fallback)', concern_id: c.concern_id, concern: c.display_label, bridge_tag: c.relational_bridge_tag, domain: c.domain, persona: c.primary_persona, severity: c.severity, priority: c.capadex_priority, curated_questions: 0 });
    }
  }
  // ambiguous bridge tags (curated tag mapping to multiple domains)
  for (const b of clarityBridge) {
    const rows = concernByBridge.get(b) || [];
    const domains = new Set(rows.map((r) => norm(r.domain)).filter(Boolean));
    if (domains.size > 1) bridgeIssues.push({ issue: 'curated bridge_tag spans multiple domains (ambiguous join)', bridge_tag: b, domains: [...domains].join('|'), concern_count: rows.length, curated_questions: byBridgeIdx.get(b)?.length || 0 });
  }

  // ── signal coverage gaps ──
  const signalGaps = [];
  for (const c of concerns) {
    const b = norm(c.relational_bridge_tag);
    const mapped = b && signalBridge.has(b);
    if (!mapped) signalGaps.push({ concern_id: c.concern_id, concern: c.display_label, bridge_tag: c.relational_bridge_tag, signal_cluster: c.signal_cluster, domain: c.domain, persona: c.primary_persona, has_signal_cluster_text: c.signal_cluster ? 'yes' : 'no', issue: 'concern bridge_tag not present in signal ontology' });
  }

  // ── root-cause coverage gaps ──
  const rootGaps = [];
  for (const c of concerns) {
    const b = norm(c.relational_bridge_tag);
    const curated = b ? (byBridgeIdx.get(b)?.length || 0) : 0;
    const noRoot = !norm(c.root_cause_group);
    if (curated === 0 || noRoot) rootGaps.push({ concern_id: c.concern_id, concern: c.display_label, domain: c.domain, persona: c.primary_persona, severity: c.severity, priority: c.capadex_priority, curated_questions: curated, root_cause_group: c.root_cause_group || '(missing)', intervention_lens: c.intervention_lens || '(missing)' });
  }

  // ── coverage gaps: concerns whose OWN bridge tag has no curated questions ──
  // RUNTIME-FAITHFUL: production resolveCoveredBridgeTag() remaps orphan tags to a
  // covered bucket (override → keyword → GENERAL_CONCERN), so these concerns almost
  // never hit *static* fallback — instead they lose concern-specific curation and
  // inherit ANOTHER bucket's questions. `resolves_to` records the runtime target and
  // `route` the resolution path. `route='static_fallback'` is the only true-static case.
  const fallback = [];
  const routeTally = {};
  for (const c of concerns) {
    const b = norm(c.relational_bridge_tag);
    const ownCovered = b && clarityBridge.has(b);
    if (ownCovered) continue; // concern reaches its own curated questions
    const { target, route } = resolveCoveredBridgeTag(c.relational_bridge_tag, coveredUpper);
    routeTally[route] = (routeTally[route] || 0) + 1;
    fallback.push({
      concern_id: c.concern_id, concern: c.display_label, domain: c.domain,
      persona: c.primary_persona, severity: c.severity, priority: c.capadex_priority,
      bridge_tag: c.relational_bridge_tag,
      resolves_to: route === 'static_fallback' ? 'static_fallback'
        : route === 'general' ? 'GENERAL_CONCERN (generic catch-all)'
        : `remapped:${target}`,
      route,
    });
  }

  // ── rank + write reports ──
  const counts = {};
  counts.audit_dataset = writeCsv('audit_dataset.csv',
    ['concern_id', 'concern_name', 'concern_family', 'bridge_tag', 'question_id', 'question_text', 'response_type', 'options', 'persona', 'age_group', 'industry', 'weight'], dataset);

  counts.question_quality_scores = writeCsv('question_quality_scores.csv',
    ['question_id', 'concern_id', 'bridge_tag', 'relevance', 'grammar', 'sophistication', 'personalization', 'information_gain', 'root_cause_utility', 'composite', 'question_text'], qScores);

  counts.option_quality_scores = writeCsv('option_quality_scores.csv',
    ['question_id', 'concern_id', 'response_type', 'distinctiveness', 'diagnostic_power', 'signal_value', 'human_readability', 'behavioral_realism', 'composite', 'options'], oScores);

  const weakQ = [...qScores].sort((a, b) => a.composite - b.composite).slice(0, 1000);
  counts.top_1000_weak_questions = writeCsv('top_1000_weak_questions.csv',
    ['question_id', 'concern_id', 'bridge_tag', 'composite', 'relevance', 'grammar', 'sophistication', 'personalization', 'information_gain', 'root_cause_utility', 'question_text'], weakQ);

  const weakO = [...oScores].sort((a, b) => a.composite - b.composite).slice(0, 500);
  counts.top_500_weak_option_sets = writeCsv('top_500_weak_option_sets.csv',
    ['question_id', 'concern_id', 'response_type', 'composite', 'distinctiveness', 'diagnostic_power', 'signal_value', 'human_readability', 'behavioral_realism', 'options'], weakO);

  const allDups = [...exactDups, ...semDups.sort((a, b) => b.similarity - a.similarity)].slice(0, 500);
  counts.top_500_duplicate_questions = writeCsv('top_500_duplicate_questions.csv',
    ['kind', 'similarity', 'question_id_a', 'bridge_a', 'question_id_b', 'bridge_b', 'question_text', 'question_text_b'], allDups);

  bridgeIssues.sort((a, b) => (b.curated_questions === 0 ? 1 : 0) - (a.curated_questions === 0 ? 1 : 0));
  counts.top_100_bridge_tag_issues = writeCsv('top_100_bridge_tag_issues.csv',
    ['issue', 'concern_id', 'concern', 'bridge_tag', 'domain', 'persona', 'severity', 'priority', 'domains', 'concern_count', 'curated_questions'], bridgeIssues.slice(0, 100));

  proxyIssues.sort((a, b) => b.score - a.score);
  counts.top_100_proxy_language_issues = writeCsv('top_100_proxy_language_issues.csv',
    ['question_id', 'concern_id', 'bridge_tag', 'reasons', 'question_text'],
    proxyIssues.slice(0, 100).map((p) => ({ question_id: p.q.question_id, concern_id: p.q.concern_id, bridge_tag: p.q.master_bridge_tag, reasons: p.reasons, question_text: p.q.question })));

  personaMismatches.sort((a, b) => b.qHits - a.qHits);
  counts.top_100_persona_mismatches = writeCsv('top_100_persona_mismatches.csv',
    ['question_id', 'concern_id', 'bridge_tag', 'question_persona_signal', 'signal_hits', 'concern_persona', 'concern_persona_group', 'question_text'],
    personaMismatches.slice(0, 100).map((p) => ({ question_id: p.q.question_id, concern_id: p.q.concern_id, bridge_tag: p.q.master_bridge_tag, question_persona_signal: p.qGroup, signal_hits: p.qHits, concern_persona: p.concernPersona, concern_persona_group: p.concernGroup, question_text: p.q.question })));

  industryHits.sort((a, b) => b.hits - a.hits);
  counts.top_100_industry_mismatches = writeCsv('top_100_industry_mismatches.csv',
    ['question_id', 'concern_id', 'bridge_tag', 'concern_persona', 'industry_terms', 'term_count', 'question_text'],
    industryHits.slice(0, 100).map((p) => ({ question_id: p.q.question_id, concern_id: p.q.concern_id, bridge_tag: p.q.master_bridge_tag, concern_persona: p.concernPersona || '', industry_terms: p.terms, term_count: p.hits, question_text: p.q.question })));

  signalGaps.sort((a, b) => (a.has_signal_cluster_text === 'no' ? -1 : 1) - (b.has_signal_cluster_text === 'no' ? -1 : 1));
  counts.signal_coverage_gaps = writeCsv('signal_coverage_gaps.csv',
    ['concern_id', 'concern', 'bridge_tag', 'signal_cluster', 'domain', 'persona', 'has_signal_cluster_text', 'issue'], signalGaps);

  fallback.sort((a, b) => norm(b.priority).localeCompare(norm(a.priority)));
  counts.fallback_overuse = writeCsv('fallback_overuse.csv',
    ['concern_id', 'concern', 'domain', 'persona', 'severity', 'priority', 'bridge_tag', 'resolves_to', 'route'], fallback);

  counts.response_type_mismatches = writeCsv('response_type_mismatches.csv',
    ['question_id', 'concern_id', 'response_type', 'reasons', 'question_text'],
    responseTypeMismatches.map((r) => ({ question_id: r.q.question_id, concern_id: r.q.concern_id, response_type: r.q.response_type, reasons: r.reasons, question_text: r.q.question })));

  counts.root_cause_coverage_gaps = writeCsv('root_cause_coverage_gaps.csv',
    ['concern_id', 'concern', 'domain', 'persona', 'severity', 'priority', 'curated_questions', 'root_cause_group', 'intervention_lens'], rootGaps);

  // ── summary aggregates ──
  const qComp = qScores.map((q) => q.composite);
  const oComp = oScores.map((o) => o.composite);
  const summary = {
    generated_at: new Date().toISOString(),
    dataset_rows: dataset.length,
    concerns_total: concerns.length,
    concern_bridge_tags_total: concernByBridge.size,
    concern_bridge_tags_with_curated_questions: [...concernByBridge.keys()].filter((b) => clarityBridge.has(b)).length,
    concern_bridge_tags_uncovered: [...concernByBridge.keys()].filter((b) => !clarityBridge.has(b)).length,
    signals_total: sig.rows.length,
    atomic_signals_total: atom.rows.length,
    adaptive_bank_rows: adapt.rows.length,
    question_quality: { mean: round(mean(qComp)), p10: percentile(qComp, 10), median: percentile(qComp, 50), below_50: qComp.filter((x) => x < 50).length, below_40_irrelevant: qScores.filter((q) => q.relevance < 40).length },
    option_quality: { mean: round(mean(oComp)), p10: percentile(oComp, 10), median: percentile(oComp, 50), below_50_weak: oComp.filter((x) => x < 50).length },
    issues: {
      irrelevant_questions: qScores.filter((q) => q.relevance < 40).length,
      weak_option_sets: oComp.filter((x) => x < 50).length,
      exact_duplicate_pairs: exactDups.length,
      semantic_duplicate_pairs: semDups.length,
      proxy_language_issues: proxyIssues.length,
      persona_mismatches: personaMismatches.length,
      industry_jargon_questions: industryHits.length,
      industry_dimension_modelled: false,
      root_cause_coverage_gaps: rootGaps.length,
      signal_mapping_gaps: signalGaps.length,
      bridge_tag_issues: bridgeIssues.length,
      fallback_overuse_concerns: fallback.length,
      coverage_gap_routes: routeTally, // {covered_self?,override,keyword,general,static_fallback}
      true_static_fallback_concerns: routeTally.static_fallback || 0,
      generic_catchall_concerns: routeTally.general || 0,
      remapped_concerns: (routeTally.override || 0) + (routeTally.keyword || 0),
      response_type_mismatches: responseTypeMismatches.length,
      malformed_questions: malformed.length,
      malformed_example: malformed[0] || null,
    },
    report_row_counts: counts,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'audit_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'REMEDIATION_REPORT.md'), buildRemediationReport(summary));

  console.log('\n==== AUDIT SUMMARY ====');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReports written to ${OUT_DIR}`);
  await pool.end();
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// Generates REMEDIATION_REPORT.md from the live audit summary so the narrative
// numbers can never drift from the CSVs. All figures interpolated from `s`.
function buildRemediationReport(s) {
  const i = s.issues;
  const total = s.concern_bridge_tags_total;
  const covered = s.concern_bridge_tags_with_curated_questions;
  const uncovered = s.concern_bridge_tags_uncovered;
  const coveragePct = total ? Math.round((covered / total) * 100) : 0;
  const malformedNote = i.malformed_questions
    ? `**${i.malformed_questions} genuinely malformed rows**, e.g. \`${i.malformed_example}\` (degenerate <2-word text)`
    : 'no malformed (<2-word) rows';
  return `# CAPADEX Question Intelligence Layer — Phase 1 Audit & Remediation Report

> **Auto-generated** by \`backend/scripts/audit/question-intelligence-audit.mjs\` on ${s.generated_at}.
> Every number below is interpolated from the live audit run — edit the script, not this file.

**Phase:** 1 — Discovery & Diagnostics **only**. No production behaviour was changed.
**Method:** A single read-only script loaded the live tables, scored every question/option
set, detected 12 issue classes, and emitted the CSV reports in this directory. The script
makes **zero writes** to the database.

> **Reproduce:** \`cd backend && node scripts/audit/question-intelligence-audit.mjs\`

---

## 1. Scope of what was audited

| Table | Rows | Role |
|---|---|---|
| \`capadex_clarity_questions\` | ${s.dataset_rows.toLocaleString()} | Curated question bank (the asset under audit) |
| \`capadex_concerns_master\` | ${s.concerns_total.toLocaleString()} | Concern taxonomy (${total} distinct bridge tags) |
| \`capadex_signals\` | ${(s.signals_total ?? 0).toLocaleString()} | Tier-3 signal ontology |
| \`capadex_atomic_signals\` | ${(s.atomic_signals_total ?? 0).toLocaleString()} | Tier-4 atomic signals |
| \`adaptive_question_bank\` | ${s.adaptive_bank_rows} | Dynamic fallback pool |

**Structural facts discovered (these shape every finding below):**

1. Questions carry **no persona / age / industry columns**. Those attributes are inherited
   from the concern the question bridges to (via \`master_bridge_tag\` → the bridge bucket's
   modal \`primary_persona\`, \`age_min/max\`). \`clarity.concern_id\` is a **question-set id**
   (e.g. \`RECALL_001\`), NOT a join key into \`concerns_master\` — so persona/age/concept are
   derived from the **bridge bucket profile** (modal values across the bucket), never from an
   arbitrary single concern row. \`industry\` is **empty for every row** — industry is not
   modelled anywhere in the schema.
2. \`response_type\` is a **scale-label** (\`frequency\`, \`confidence\`, \`intensity\`,
   \`agreement\`…), **not a structural input type**. Every curated question is effectively a
   5-point graded scale.
3. Curated questions reach concerns through **${covered} distinct bridge tags**, but the concern
   taxonomy defines **${total}**. The ${uncovered} uncovered tags are the single largest finding.

---

## 2. Headline findings

> **The bank's *craft* is high; its *coverage* is the crisis.** Individual questions and their
> option sets are, on average, well written. The problem is that only **${covered} of ${total}**
> concern bridge tags (~${coveragePct}%) carry their OWN curated questions. The other
> ${uncovered} tags do **not** hit hardcoded static fallback at runtime — production's
> \`resolveCoveredBridgeTag\` **remaps** them to a covered bucket (a specific sibling bucket, or
> \`GENERAL_CONCERN\` as the catch-all). So the real defect is **loss of concern-specific
> curation** (${i.fallback_overuse_concerns} concerns inherit *another* bucket's questions), not
> literal static fallback (only **${i.true_static_fallback_concerns}** concerns truly fall through).

| Metric | Value | Read |
|---|---|---|
| Mean question composite (0–100) | **${s.question_quality.mean}** | Craft is strong |
| Mean option-set composite (0–100) | **${s.option_quality.mean}** | Option design is strong |
| Concern bridge tags **with** curated questions | **${covered} / ${total} (${coveragePct}%)** | — |
| Concern bridge tags **uncovered** | **${uncovered} / ${total}** | ⚠ coverage crisis |
| Concerns lacking own curated questions (remapped at runtime) | **${i.fallback_overuse_concerns}** | ⚠ coverage gap |
| ↳ remapped to a specific sibling bucket | **${i.remapped_concerns}** | inherit related questions |
| ↳ remapped to \`GENERAL_CONCERN\` catch-all | **${i.generic_catchall_concerns}** | ⚠ generic questions |
| ↳ true static fallback (no covered target) | **${i.true_static_fallback_concerns}** | — |
| Concerns with **no signal-ontology mapping** | **${i.signal_mapping_gaps}** | ⚠ signal gaps |
| Adaptive bank rows (the buffer before remap) | **${s.adaptive_bank_rows}** | ⚠ effectively empty |

### Issue tally (all 12 requested classes)

| # | Issue class | Count | Report file |
|---|---|---|---|
| 1 | Irrelevant questions (relevance < 40) | ${i.irrelevant_questions} | \`top_1000_weak_questions.csv\` |
| 2 | Weak option sets (composite < 50) | ${i.weak_option_sets} | \`top_500_weak_option_sets.csv\` |
| 3 | Exact duplicate question pairs | ${i.exact_duplicate_pairs} | \`top_500_duplicate_questions.csv\` |
| 4 | Semantic duplicate pairs (Jaccard ≥ 0.82) | ${i.semantic_duplicate_pairs} | \`top_500_duplicate_questions.csv\` |
| 5 | Proxy-language issues | ${i.proxy_language_issues} | \`top_100_proxy_language_issues.csv\` |
| 6 | Persona mismatches (cross-context) | ${i.persona_mismatches} | \`top_100_persona_mismatches.csv\` |
| 7 | Industry mismatches (+ unmodelled dimension) | ${i.industry_jargon_questions} | \`top_100_industry_mismatches.csv\` |
| 8 | Root-cause coverage gaps | ${i.root_cause_coverage_gaps} | \`root_cause_coverage_gaps.csv\` |
| 9 | Signal-mapping gaps | ${i.signal_mapping_gaps} | \`signal_coverage_gaps.csv\` |
| 10 | Bridge-tag issues (leakage/ambiguity) | ${i.bridge_tag_issues} | \`top_100_bridge_tag_issues.csv\` |
| 11 | Coverage-gap concerns (remapped at runtime; ${i.true_static_fallback_concerns} true static) | ${i.fallback_overuse_concerns} | \`fallback_overuse.csv\` |
| 12 | Response-type mismatches | ${i.response_type_mismatches} | \`response_type_mismatches.csv\` |

---

## 3. Audit dataset

\`audit_dataset.csv\` — one row per question with the requested fields:
\`concern_id, concern_name, concern_family, bridge_tag, question_id, question_text,
response_type, options, persona, age_group, industry, weight\`.

- \`persona\` / \`age_group\` / \`concern_family\` are **derived from the bridge bucket profile**
  (modal values across the bucket the question bridges to), because questions have no such columns
  and \`concern_id\` is a question-set id, not a taxonomy join key.
- \`industry\` is **always empty** — the dimension does not exist in the schema (finding #7).
- \`options\` joins the non-empty \`option_a..e\` with \` | \`.

---

## 4. Scoring methodology (deterministic heuristics)

Scoring is **automated heuristic**, not human/LLM judgement, so the full ${s.dataset_rows.toLocaleString()}-row
bank can be scored reproducibly and at no cost. **These are proxies** — see the roadmap (§6,
Phase R4) for the recommended LLM-assisted re-scoring pass.

### Question quality (0–100 each, composite = mean of the six)

| Dimension | Heuristic |
|---|---|
| **Relevance** | Token overlap between the question and its **bridge bucket** concept vocabulary (modal labels/cluster/domain across the bucket) + the question's own authored concern label. 0→35, 1→60, 2→78, 3+→92; +6 if 2nd-person. <40 ⇒ flagged irrelevant. |
| **Grammar** | Start 100; penalise no terminal \`?\`, double spaces, stray whitespace, repeated words, broken 3rd-person conjugation, un-capitalised start, >45 words. |
| **Sophistication** | Word-count in 8–28 band + unique-word ratio + context clause + content-token richness; penalise vague words. |
| **Personalization** | +2nd-person, +context framing, +situational nouns; penalise reused stems (templating) and impersonal phrasing. |
| **Information Gain** | Distinct option-score levels + score range + option count. |
| **Root-Cause Utility** | Bridge bucket has \`root_cause_group\` (+30) / \`intervention_lens\` (+18) / resolvable signal mapping (+22); question_type probes mechanism; diagnostic stems. |

### Option-set quality (0–100 each, composite = mean of the five)

| Dimension | Heuristic |
|---|---|
| **Distinctiveness** | Distinct normalised option texts / option count. |
| **Diagnostic Power** | Distinct score levels / (option count − 1). |
| **Signal Value** | Both low/high anchors present + full score range + monotonic ordering. |
| **Human Readability** | ≥2 options, average 1–6 words, none over-long. |
| **Behavioral Realism** | Graded behavioural/frequency vocabulary, ≥3 options, monotonic; penalise bare Yes/No. |

> Why option scores are near-ceiling (${s.option_quality.mean}): the curated bank is overwhelmingly
> well-formed 5-point scales with clean anchors. The ${i.weak_option_sets} flagged weak sets and
> the ${i.response_type_mismatches} response-type mismatches are the real option-layer defects.

---

## 5. Findings by issue class

### 5.1 Coverage is the dominant problem (issues #8, #9, #10, #11)
- **${uncovered} / ${total} concern bridge tags have zero curated questions.** At runtime
  \`pickQuestionsFromMaster\` does NOT drop these to static — it calls \`resolveCoveredBridgeTag\`,
  which **remaps** the orphan tag to a covered bucket (override → keyword → \`GENERAL_CONCERN\`).
  \`fallback_overuse.csv\` lists the **${i.fallback_overuse_concerns} concerns** lacking their own
  curated questions, with a \`route\`/\`resolves_to\` per concern: **${i.remapped_concerns}** remap to
  a specific sibling bucket (inherit related but not concern-specific questions), **${i.generic_catchall_concerns}**
  fall to the \`GENERAL_CONCERN\` generic catch-all, and only **${i.true_static_fallback_concerns}**
  have no covered target at all. The defect is *loss of concern-specificity*, not literal static fallback.
- **${i.signal_mapping_gaps} concerns have no signal-ontology mapping** (\`signal_coverage_gaps.csv\`) —
  their \`relational_bridge_tag\` is absent from the signal ontology, so the spine cannot light up.
- **${i.root_cause_coverage_gaps} concerns are missing curated questions and/or a \`root_cause_group\`**
  (\`root_cause_coverage_gaps.csv\`).

### 5.2 Duplication (issues #3, #4)
- **${i.exact_duplicate_pairs} exact-duplicate pairs** — frequently the *same* question registered
  under two bridge tags, or \`_v2\` clones. **${i.semantic_duplicate_pairs} semantic near-duplicates**
  (Jaccard ≥ 0.82) within a bridge bucket. Duplicates waste assessment length and bias aggregation.

### 5.3 Proxy-language (issue #5) — **${i.proxy_language_issues} questions**
- Two dominant defects: **first-person fragments** embedded in the stem which the reframer cannot
  rewrite cleanly, and **stems with no 2nd-person anchor** for the proxy regex to convert. Also
  dangling reflexives (\`yourself\`) after 3rd-person rewrite.

### 5.4 Persona & industry (issues #6, #7)
- **${i.persona_mismatches} cross-context persona mismatches**: a question's edu-vs-work macro
  context is absent from the bridge bucket's persona macro set (buckets spanning both are never
  flagged, to avoid false positives).
- **Industry is structurally unmodelled.** ${i.industry_jargon_questions} questions hard-code
  industry/context jargon but there is no industry dimension to validate against — a *schema gap*,
  reported honestly rather than fabricated.

### 5.5 Quality outliers (issues #1, #2, #12)
- Only **${i.irrelevant_questions} irrelevant** and **${i.weak_option_sets} weak option sets** —
  the long tail is healthy. But there are ${malformedNote}.
- **${i.response_type_mismatches} response-type mismatches**: most are \`frequency\`-typed questions
  that actually ask about *duration* or *speed* — the scale label contradicts the stem.

---

## 6. Remediation roadmap (proposed — Phase 2+)

Ordered by impact-to-effort. **All of this is future work; nothing here was executed in Phase 1.**

### Phase R1 — Coverage (highest impact)
- Generate/curate questions for the **${uncovered} uncovered bridge tags**, prioritising the
  **${i.generic_catchall_concerns} concerns that remap to the \`GENERAL_CONCERN\` catch-all** (the
  most generic, least concern-specific runtime path) and then the **${i.remapped_concerns}** that
  inherit a sibling bucket's questions — both ranked by \`capadex_priority\` / \`severity\` in
  \`fallback_overuse.csv\`. Target: every concern reaches its OWN curated questions (no remap).
- Map the **${i.signal_mapping_gaps} signal-gap concerns** to the existing signal ontology (or extend it).

### Phase R2 — De-duplication & integrity
- Resolve the **${i.exact_duplicate_pairs} exact + ${i.semantic_duplicate_pairs} semantic** duplicate
  pairs: keep one canonical question per intent, re-point bridge tags rather than cloning. Fix
  malformed rows.
- Add a **DB/CI integrity check** (min length, terminal \`?\`, ≥2 distinct option scores, bridge tag
  resolves) to prevent regressions — runnable via the validation skill.

### Phase R3 — Linguistic correctness
- Rewrite the **${i.proxy_language_issues} proxy-language** questions to remove embedded first-person
  fragments and guarantee a 2nd-person anchor; add proxy-reframe unit fixtures.
- Reconcile the **${i.response_type_mismatches} response-type mismatches**.

### Phase R4 — Semantic re-scoring (raise confidence in §4)
- Re-score the bank (or just the flagged tails) with an **LLM rubric** for Relevance / Sophistication
  / Behavioural Realism. Use this audit's rankings as the candidate set so the pass is cheap and targeted.

### Phase R5 — Schema evolution
- Decide whether **industry** becomes a first-class dimension or is explicitly declared out-of-scope.
- Consider promoting persona/age onto questions (vs inheriting via bridge) to make per-question
  persona validation authoritative rather than inferred.

---

## 7. File index

| File | Contents |
|---|---|
| \`audit_dataset.csv\` | Full per-question export (12 requested fields), ${s.dataset_rows.toLocaleString()} rows |
| \`question_quality_scores.csv\` | 6-dimension + composite scores, every question |
| \`option_quality_scores.csv\` | 5-dimension + composite scores, every option set |
| \`top_1000_weak_questions.csv\` | Lowest composite questions |
| \`top_500_weak_option_sets.csv\` | Lowest composite option sets |
| \`top_500_duplicate_questions.csv\` | Exact + semantic duplicate pairs |
| \`top_100_bridge_tag_issues.csv\` | Uncovered / ambiguous / empty bridge tags |
| \`top_100_proxy_language_issues.csv\` | First-person / un-reframable / reflexive stems |
| \`top_100_persona_mismatches.csv\` | Cross-context persona conflicts |
| \`top_100_industry_mismatches.csv\` | Industry-jargon questions (dimension unmodelled) |
| \`signal_coverage_gaps.csv\` | Concerns absent from the signal ontology |
| \`fallback_overuse.csv\` | Concerns lacking own curated questions (+ runtime remap target/route) |
| \`response_type_mismatches.csv\` | Scale label vs option/stem contradictions |
| \`root_cause_coverage_gaps.csv\` | Concerns missing curated questions and/or root-cause group |
| \`audit_summary.json\` | Machine-readable aggregate of every metric above |
`;
}

main().catch((e) => { console.error(e); process.exit(1); });
