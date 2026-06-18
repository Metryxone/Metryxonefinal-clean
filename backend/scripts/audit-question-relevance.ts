/* eslint-disable no-console */
/**
 * CAPADEX Question Relevance Audit
 * ---------------------------------
 * Read-only audit of the concern -> question relevance engine. Replicates the
 * live picker's bridge-tag resolution (own tag -> orphan override / keyword
 * rules -> GENERAL_CONCERN) so the report reflects what users actually receive.
 *
 * For every concern it emits: concern_id, concern_name, bridge_tag (own +
 * effective), the questions that would be served, each question's response_type
 * and options, and a 1-5 relevance/root-cause score.
 *
 * Outputs:
 *   audit/CAPADEX_QUESTION_RELEVANCE_AUDIT.md   (human report + top-100 worst)
 *   backend/scripts/out/question-relevance-audit.csv  (per concern-question row)
 *
 * Run:  cd backend && npx tsx scripts/audit-question-relevance.ts
 */
import { Pool } from 'pg';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const CLARITY_TARGET = 10;
const SAMPLE_PER_CONCERN = 6; // questions sampled per concern for scoring

// ─── Resolution tables (mirror backend/routes/capadex-concern-intelligence.ts) ──
const COVERED_BRIDGE_TAGS = new Set<string>([
  'EMOTIONAL_REGULATION','COMPETENCY_DEVELOPMENT','EMPLOYABILITY','SOCIAL_EMOTIONAL',
  'DISCIPLINE_HABITS','CAREER_GROWTH','CAREER_READINESS','EMOTIONAL_RECOVERY',
  'CONFIDENCE_SELF','HOLISTIC_DEVELOPMENT','WORKPLACE_ADAPTATION','MOTIVATION_VALUES',
  'ADJUSTMENT_COPING','THINKING_QUALITY','ACADEMIC_COGNITIVE','EXAMINATION_STRESS',
  'STRATEGIC_PREPARATION','LEADERSHIP_OWNERSHIP','LEARNING_ADAPTABILITY','LIFESTYLE_PRESSURE',
  'SELF_REFLECTION','ACADEMIC_IDENTITY','CONFIDENCE_DEVELOPMENT','COMMUNICATION_EXPRESSION',
  'LONG_TERM','GENERAL_CONCERN','CAREER_PSYCHOLOGY','PERSONAL_VISION','STEM_LEARNING',
  'CAREER_EXPECTATIONS','ADAPTIVE_LEADERSHIP','CAREER_IDENTITY','PERFORMANCE_REFLECTION',
  'ACADEMIC_TRANSITION','CONFIDENCE_BUILDING','LEARNING_DEPENDENCY','CAREER_EXPOSURE',
  'CLASSROOM_ENGAGEMENT','COMPETENCY_INTELLIGENCE','OVER_COMPLIANCE','COMPETITIVE_EXAM',
  'SELF_PERCEPTION','EMOTIONAL_IDENTITY','WORKPLACE_FIT','STUDENT_SUCCESS',
  'TRANSITION_READINESS','HIGHER_EDUCATION','IDENTITY_INTEGRATION','INSTRUCTIONAL_QUALITY',
  'LEADERSHIP_INFLUENCE','FUTURE_LEARNING','LEADERSHIP_READINESS','FOUNDATIONAL_LEARNING',
  'LEARNING_AWARENESS','LEARNING_QUALITY','MULTI_POTENTIALITY',
]);
const GENERAL_FALLBACK_TAG = 'GENERAL_CONCERN';
const ORPHAN_BRIDGE_TAG_FALLBACK: Record<string, string> = {
  CAREER_TRANSITION: 'CAREER_GROWTH', EXAMINATION_READINESS: 'EXAMINATION_STRESS',
  COLLABORATION_OWNERSHIP: 'LEADERSHIP_OWNERSHIP', STRATEGIC_LEADERSHIP: 'ADAPTIVE_LEADERSHIP',
  ADAPTIVE_LEARNING: 'LEARNING_ADAPTABILITY', INTERDISCIPLINARY_LEARNING: 'LEARNING_ADAPTABILITY',
  WORKPLACE_PERFORMANCE: 'WORKPLACE_ADAPTATION', ACADEMIC_PERFORMANCE: 'ACADEMIC_COGNITIVE',
  HELP_SEEKING: 'ADJUSTMENT_COPING', INQUIRY_CURIOSITY: 'THINKING_QUALITY',
};
const BRIDGE_TAG_KEYWORD_RULES: Array<[RegExp, string]> = [
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
function resolveCoveredBridgeTag(tag: string | null | undefined): string | null {
  const up = String(tag || '').toUpperCase().trim();
  if (!up) return null;
  if (COVERED_BRIDGE_TAGS.has(up)) return up;
  const override = ORPHAN_BRIDGE_TAG_FALLBACK[up];
  if (override && COVERED_BRIDGE_TAGS.has(override)) return override;
  for (const [re, target] of BRIDGE_TAG_KEYWORD_RULES) if (re.test(up) && COVERED_BRIDGE_TAGS.has(target)) return target;
  return COVERED_BRIDGE_TAGS.has(GENERAL_FALLBACK_TAG) ? GENERAL_FALLBACK_TAG : null;
}

// ─── Heuristic classifiers ───────────────────────────────────────────────────
const FREQ_SCALE = new Set(['never','rarely','sometimes','often','always']);
// Words that signal an ordinal/Likert scale option rather than a diagnostic cause.
const SCALE_ADVERB = /\b(never|rarely|sometimes|often|always|slightly|moderately|very|extremely|not at all|completely|mildly?|severe(ly)?|low|high|neutral|disagree|agree|ineffective|effective|uncomfortable|comfortable|confused|clear|ready|drained|energ(y|etic)|like me|true|impact|confident|none|some|much|frequent|occasional|constant)\b/i;
const ROOT_CAUSE_Q = /\bwhat\b[^?]*\b(cause|caus|lead|leads|reason|driv|makes you|make you|holds you back|hold you back|gets in the way|get in the way|stops you|stop you|behind|gets in your way|prevents|stands in)\b|\bwhy\s+(do|are|is|does)\b|\bwhat is the (main|biggest|root|primary)\b|\bwhich (of these|best describes|factor)\b|\bwhat usually happens\b/i;
const FREQ_Q = /^\s*(how often|how frequently|how regularly|how many times)\b/i;

function optionsAreScale(opts: string[]): boolean {
  if (opts.length < 2) return true;
  const scaleHits = opts.filter(o => SCALE_ADVERB.test(o)).length;
  return scaleHits >= Math.ceil(opts.length * 0.5);
}
function optionsAreFreqScale(opts: string[]): boolean {
  const norm = opts.map(o => o.trim().toLowerCase());
  const hits = norm.filter(o => FREQ_SCALE.has(o)).length;
  return hits >= 2;
}
function optionsAreDiagnostic(opts: string[]): boolean {
  return opts.length >= 3 && !optionsAreScale(opts);
}

const STOP = new Set(['the','a','an','of','to','in','on','for','and','or','your','you','do','how','what','when','i','my','with','about','feel','feeling','often','this','that','it','at','as','is','are','am','be','more','most','than','their','them','they','our','we','me','myself','still','even','after','while','during','keep','up','out']);
function tokens(s: string): Set<string> {
  return new Set((s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
}
function topicalOverlap(qText: string, concernTokens: Set<string>): number {
  if (concernTokens.size === 0) return 0;
  const qt = tokens(qText);
  let hit = 0;
  for (const t of concernTokens) if (qt.has(t)) hit++;
  return hit / concernTokens.size;
}

/**
 * Relevance/root-cause score 1-5 per the brief:
 *   5 Direct root cause exploration · 4 Strongly related · 3 Indirectly related
 *   2 Weakly related · 1 Unrelated
 */
function scoreQuestion(qText: string, opts: string[], concernTokens: Set<string>, effectiveTagDiffersFromOwn: boolean, isGeneralFallback: boolean): number {
  const rootCause = ROOT_CAUSE_Q.test(qText);
  const diagnostic = optionsAreDiagnostic(opts);
  const freq = FREQ_Q.test(qText) || optionsAreFreqScale(opts);
  const T = topicalOverlap(qText, concernTokens);
  let score: number;
  if (rootCause && diagnostic) score = 5;
  else if (rootCause || diagnostic) score = 4;
  else if (!freq && T >= 0.25) score = 4;
  else if (T > 0 && !freq) score = 3;
  else if (T > 0 && freq) score = 3;
  else if (freq) score = 2;
  else score = 2;
  // Penalties for weak/served-from-adjacent routing.
  if (isGeneralFallback) score = Math.min(score, 2);
  else if (effectiveTagDiffersFromOwn && T === 0) score = Math.min(score, 2);
  if (T === 0 && !rootCause && !diagnostic && (isGeneralFallback || effectiveTagDiffersFromOwn)) score = 1;
  return score;
}

// ─── Expected option vocabulary per declared response_type (mismatch check) ────
function responseTypeMismatch(responseType: string, opts: string[]): boolean {
  const rt = (responseType || '').toLowerCase().trim();
  const freqOpts = optionsAreFreqScale(opts);
  if (rt === 'frequency') return !freqOpts;            // declared frequency but options aren't the scale
  if (rt && rt !== 'frequency' && freqOpts) return true; // declared a richer scale but shipped generic frequency options
  return false;
}

type ClarityRow = { id: number; question: string; response_type: string; options: string[]; weight: number };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
  const pool = new Pool({ connectionString: url, max: 4 });

  console.log('Loading clarity questions…');
  const cq = await pool.query(`
    SELECT id, question, response_type, option_a, option_b, option_c, option_d, option_e,
           question_weight, LOWER(TRIM(master_bridge_tag)) AS tag
      FROM capadex_clarity_questions
     WHERE question IS NOT NULL AND TRIM(question) <> ''`);
  const byTag = new Map<string, ClarityRow[]>();
  for (const r of cq.rows) {
    const opts = [r.option_a, r.option_b, r.option_c, r.option_d, r.option_e]
      .filter((o: unknown): o is string => typeof o === 'string' && o.trim().length > 0);
    if (opts.length < 2) continue;
    const row: ClarityRow = { id: r.id, question: r.question, response_type: r.response_type || 'frequency', options: opts, weight: Number(r.question_weight) || 1 };
    const list = byTag.get(r.tag) || [];
    list.push(row);
    byTag.set(r.tag, list);
  }
  // Order each tag's pool by weight desc (the picker's primary ordering).
  for (const list of byTag.values()) list.sort((a, b) => b.weight - a.weight);
  console.log(`  ${cq.rows.length} clarity rows across ${byTag.size} covered tags`);

  console.log('Loading concerns…');
  const cm = await pool.query(`
    SELECT concern_id, COALESCE(NULLIF(TRIM(display_label),''), concern_cluster) AS name,
           concern_cluster, domain, relational_bridge_tag, primary_persona
      FROM capadex_concerns_master ORDER BY concern_id`);
  console.log(`  ${cm.rows.length} concerns`);

  // ── Per concern-question records + aggregates ──
  const csvRows: string[] = ['concern_id,concern_name,own_bridge_tag,effective_bridge_tag,coverage,question_id,response_type,relevance_score,question,options'];
  const worst: Array<{ score: number; concern_id: string; name: string; tag: string; q: string; rt: string; opts: string[] }> = [];
  const fallbackConcerns: Array<{ id: string; name: string; own: string; eff: string; ownN: number }> = [];
  const lowCoverage: Array<{ id: string; name: string; own: string; ownN: number }> = [];
  const tagScores = new Map<string, { sum: number; n: number }>();
  let mismatchCount = 0;
  const mismatchExamples: Array<{ qid: number; rt: string; opts: string[]; q: string }> = [];
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let belowFour = 0, totalScored = 0, rootCauseDiag = 0;

  for (const c of cm.rows) {
    const ownTag = String(c.relational_bridge_tag || '').toUpperCase().trim();
    const ownPool = byTag.get(ownTag.toLowerCase()) || [];
    const ownN = ownPool.length;
    const effTag = ownN >= 2 ? ownTag : (resolveCoveredBridgeTag(ownTag) || GENERAL_FALLBACK_TAG);
    const pool2 = ownN >= 2 ? ownPool : (byTag.get(effTag.toLowerCase()) || []);
    const isFallback = ownN < 2;
    const isGeneral = isFallback && effTag === GENERAL_FALLBACK_TAG;
    const effDiffers = effTag.toUpperCase() !== ownTag.toUpperCase();
    if (isFallback) fallbackConcerns.push({ id: c.concern_id, name: c.name, own: ownTag, eff: effTag, ownN });
    if (ownN < CLARITY_TARGET) lowCoverage.push({ id: c.concern_id, name: c.name, own: ownTag, ownN });

    const concernTokens = tokens(`${c.name} ${c.concern_cluster} ${c.domain}`);
    const sample = pool2.slice(0, SAMPLE_PER_CONCERN);
    for (const q of sample) {
      const score = scoreQuestion(q.question, q.options, concernTokens, effDiffers, isGeneral);
      const rt = q.response_type;
      if (responseTypeMismatch(rt, q.options)) {
        mismatchCount++;
        if (mismatchExamples.length < 20) mismatchExamples.push({ qid: q.id, rt, opts: q.options, q: q.question });
      }
      dist[score]++; totalScored++; if (score < 4) belowFour++;
      if (ROOT_CAUSE_Q.test(q.question) && optionsAreDiagnostic(q.options)) rootCauseDiag++;
      const ts = tagScores.get(effTag) || { sum: 0, n: 0 }; ts.sum += score; ts.n++; tagScores.set(effTag, ts);
      worst.push({ score, concern_id: c.concern_id, name: c.name, tag: effTag, q: q.question, rt, opts: q.options });
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      csvRows.push([c.concern_id, esc(c.name), ownTag, effTag, ownN, `mcq_${q.id}`, rt, score, esc(q.question), esc(q.options.join(' | '))].join(','));
    }
  }

  // ── Aggregate sections ──
  const lowRelTags = [...tagScores.entries()].map(([tag, v]) => ({ tag, avg: v.sum / v.n, n: v.n }))
    .filter(t => t.avg < 3).sort((a, b) => a.avg - b.avg);
  worst.sort((a, b) => a.score - b.score || a.concern_id.localeCompare(b.concern_id));
  const top100 = worst.slice(0, 100);

  // ── Write CSV ──
  const csvPath = resolve(__dirname, 'out/question-relevance-audit.csv');
  writeFileSync(csvPath, csvRows.join('\n'), 'utf8');

  // ── Write Markdown report ──
  const pct = (n: number, d: number) => d ? `${((100 * n) / d).toFixed(1)}%` : '0%';
  const md: string[] = [];
  md.push('# CAPADEX Question Relevance Audit', '');
  md.push(`_Generated ${new Date().toISOString()} · read-only · regenerate with \`cd backend && npx tsx scripts/audit-question-relevance.ts\`_`, '');
  md.push('## 1. Methodology', '');
  md.push('- **Retrieval replicated** from the live picker: a concern is served from its own `relational_bridge_tag` when that tag has ≥2 clarity rows; otherwise it is routed via the orphan-override → keyword-rule → `GENERAL_CONCERN` cascade (`resolveCoveredBridgeTag`). Questions are ordered by `question_weight` (the picker\'s primary ordering); the top sample per concern is scored.');
  md.push('- **Relevance score (1–5):** 5 = direct root-cause exploration (cause-framed question **and** diagnostic options); 4 = strongly related (cause-framed **or** diagnostic options, or on-topic non-frequency); 3 = indirectly related (on-topic but frequency/symptom framed); 2 = weakly related (generic frequency, weak topical link or adjacent-tag routing); 1 = unrelated (no topical overlap on a fallback/adjacent bucket).');
  md.push('- **Root-cause question** = matches cause/why/"what is the main reason"/"which factor" patterns. **Diagnostic options** = ≥3 options that are NOT an ordinal/Likert scale (Never/Rarely/…, Slightly/Moderately/Very/…, Disagree/Agree, etc.).');
  md.push('- **Frequency/symptom question** = "how often…" stem OR Never/Rarely/Sometimes/Often/Always options.', '');

  md.push('## 2. Headline findings', '');
  md.push(`- **Concerns:** ${cm.rows.length} · **Clarity questions:** ${cq.rows.length} · **Covered bridge tags:** ${byTag.size}`);
  md.push(`- **Concerns on fallback questions** (own tag <2 curated rows → routed elsewhere): **${fallbackConcerns.length}** (${pct(fallbackConcerns.length, cm.rows.length)})`);
  md.push(`- **Concerns with insufficient coverage** (own tag <${CLARITY_TARGET} rows): **${lowCoverage.length}** (${pct(lowCoverage.length, cm.rows.length)})`);
  md.push(`- **Question samples scored:** ${totalScored} · **scored below 4 (flagged):** ${belowFour} (${pct(belowFour, totalScored)})`);
  md.push(`- **Direct root-cause + diagnostic-option questions:** ${rootCauseDiag} (${pct(rootCauseDiag, totalScored)}) — the core gap`);
  md.push(`- **Response-type ↔ option mismatches:** ${mismatchCount}`);
  md.push('', '**Score distribution (sampled concern-question pairs):**', '');
  md.push('| Score | Meaning | Count | Share |', '|---|---|---|---|');
  for (const s of [5, 4, 3, 2, 1]) md.push(`| ${s} | ${({5:'Direct root cause',4:'Strongly related',3:'Indirectly related',2:'Weakly related',1:'Unrelated'} as Record<number,string>)[s]} | ${dist[s]} | ${pct(dist[s], totalScored)} |`);
  md.push('');

  md.push('## 3. Concerns using fallback questions', '');
  md.push(`${fallbackConcerns.length} concerns have <2 curated questions on their own bridge tag and are served from an adjacent/general bucket. First 60:`, '');
  md.push('| concern_id | name | own_tag | served_from | own_rows |', '|---|---|---|---|---|');
  for (const f of fallbackConcerns.slice(0, 60)) md.push(`| ${f.id} | ${f.name} | ${f.own} | ${f.eff} | ${f.ownN} |`);
  if (fallbackConcerns.length > 60) md.push(`| … | _+${fallbackConcerns.length - 60} more (see CSV)_ | | | |`);
  md.push('');

  md.push('## 4. Bridge tags with low average relevance', '');
  if (lowRelTags.length === 0) md.push('_No served bridge tag averaged below 3.0._');
  else { md.push('| served_tag | avg_score | sampled |', '|---|---|---|'); for (const t of lowRelTags) md.push(`| ${t.tag} | ${t.avg.toFixed(2)} | ${t.n} |`); }
  md.push('');

  md.push('## 5. Response-type ↔ option mismatches', '');
  md.push(`${mismatchCount} sampled questions declare a \`response_type\` that does not match their option vocabulary (e.g. declared a richer scale but shipped Never/Rarely/… options, or declared \`frequency\` without the frequency scale). Examples:`, '');
  md.push('| question_id | response_type | options |', '|---|---|---|');
  for (const m of mismatchExamples) md.push(`| ${m.qid} | ${m.rt} | ${m.opts.join(' / ')} |`);
  md.push('');

  md.push('## 6. Concerns with insufficient question coverage', '');
  md.push(`${lowCoverage.length} concerns have fewer than ${CLARITY_TARGET} curated rows on their own bridge tag. First 60 (worst first):`, '');
  lowCoverage.sort((a, b) => a.ownN - b.ownN);
  md.push('| concern_id | name | own_tag | own_rows |', '|---|---|---|---|');
  for (const f of lowCoverage.slice(0, 60)) md.push(`| ${f.id} | ${f.name} | ${f.own} | ${f.ownN} |`);
  md.push('');

  md.push('## 7. Top 100 worst concern → question mappings', '');
  md.push('| # | score | concern_id | concern | served_tag | response_type | question | options |', '|---|---|---|---|---|---|---|---|');
  top100.forEach((w, i) => {
    const q = w.q.replace(/\|/g, '/').slice(0, 90);
    const o = w.opts.join(' / ').replace(/\|/g, '/').slice(0, 60);
    md.push(`| ${i + 1} | ${w.score} | ${w.concern_id} | ${w.name.replace(/\|/g,'/').slice(0,40)} | ${w.tag} | ${w.rt} | ${q} | ${o} |`);
  });
  md.push('');
  md.push('## 8. Per-concern data', '');
  md.push('Full per concern-question rows (concern_id, name, own/effective bridge tag, coverage, question_id, response_type, score, question, options) → `backend/scripts/out/question-relevance-audit.csv`.');
  md.push('');

  const mdPath = resolve(__dirname, '../../audit/CAPADEX_QUESTION_RELEVANCE_AUDIT.md');
  writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log('\n── AUDIT COMPLETE ──');
  console.log(`Concerns: ${cm.rows.length} | Fallback: ${fallbackConcerns.length} | LowCoverage: ${lowCoverage.length}`);
  console.log(`Scored: ${totalScored} | Below-4: ${belowFour} (${pct(belowFour, totalScored)}) | RootCause+Diag: ${rootCauseDiag}`);
  console.log(`Mismatches: ${mismatchCount} | LowRelTags: ${lowRelTags.length}`);
  console.log(`Report: ${mdPath}`);
  console.log(`CSV:    ${csvPath}`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
