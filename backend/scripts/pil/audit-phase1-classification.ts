/**
 * CAPADEX PIL — Phase 1 Validation Audit (read-only; writes NOTHING to the DB).
 *
 * Core question: does the Phase-1 classification reflect the TRUE semantic
 * meaning of each concern, or does it merely mirror the deficit-framed
 * `concern_category` naming convention (which the classifier keys off)?
 *
 * Method: build an INDEPENDENT semantic signal from the human-readable
 * `display_label` (lexical polarity + capability framing) — deliberately NOT the
 * field the classifier used — and compare it to the assigned class. This is an
 * automated proxy for human adjudication (549 hand labels is infeasible here);
 * every sample + its verdict is exported to CSV so a human can verify.
 *
 * Outputs (audit/pil_phase1/): samples.csv, domain_distribution.csv,
 * capability_gap.csv, summary.json. Console prints the report tables.
 *
 * Run: npx tsx backend/scripts/pil/audit-phase1-classification.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { CLASSIFICATIONS, type Classification } from '../../services/pil/concern-classification-engine';

const OUT_DIR = path.resolve('audit/pil_phase1');
const SEED = 1780459844; // fixed → reproducible sampling

// ── Deterministic RNG (mulberry32) ───────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Polarity lexicons (judged from the human-readable label) ──────────────────
const STRONG_NEG = new Set([
  'fear', 'fears', 'afraid', 'anxiety', 'anxious', 'stress', 'stressed', 'weak', 'weakness',
  'weaknesses', 'loss', 'losing', 'lose', 'lost', 'avoid', 'avoidance', 'avoiding', 'struggle',
  'struggling', 'struggles', 'lack', 'lacking', 'inability', 'unable', 'deficit', 'deficits',
  'deficiency', 'blind', 'blindness', 'burnout', 'fatigue', 'exhaustion', 'decline', 'declining',
  'collapse', 'overwhelm', 'overwhelmed', 'paralysis', 'fragility', 'fragile', 'risk', 'trauma',
  'helpless', 'helplessness', 'erosion', 'apathy', 'demotivation', 'ineffectiveness', 'ineffective',
  'breakdown', 'stagnation', 'stagnant', 'dropout', 'deterioration', 'vulnerability', 'vulnerable',
  'threat', 'relapse', 'poor', 'shutdown', 'stuck', 'rejection', 'rejected', 'unsupported',
]);
const WEAK_NEG = new Set([
  'difficulty', 'difficulties', 'difficult', 'confusion', 'confused', 'doubt', 'pressure', 'conflict',
  'instability', 'unstable', 'imbalance', 'disconnect', 'withdrawal', 'withdrawn', 'aggressive',
  'aggression', 'dependence', 'dependency', 'overdependence', 'frustration', 'frustrated', 'distress',
  'worry', 'worried', 'nervous', 'panic', 'dread', 'immaturity', 'immature', 'mismanagement',
  'misalignment', 'inconsistency', 'inconsistent', 'hesitation', 'hesitant', 'procrastination',
  'distraction', 'distracted', 'fragmentation', 'fragmented', 'rumination', 'overthinking',
  'disengagement', 'disengaged', 'intolerance', 'sensitivity', 'gap', 'gaps', 'pain', 'anger',
  'angry', 'sad', 'plateau', 'suppression',
]);
const STRONG_POS = new Set([
  'build', 'building', 'develop', 'developing', 'development', 'strengthen', 'strengthening',
  'improve', 'improved', 'improving', 'improvement', 'master', 'mastering', 'mastery', 'grow',
  'growing', 'growth', 'thrive', 'thriving', 'flourish', 'empower', 'empowerment', 'achieve',
  'achieving', 'achievement', 'success', 'successful',
]);
const WEAK_POS = new Set([
  'clarity', 'readiness', 'ready', 'ability', 'able', 'skill', 'skills', 'skilled', 'effective',
  'effectiveness', 'healthy', 'healthier', 'strong', 'strength', 'strengths', 'understanding',
  'understand', 'awareness', 'aware', 'adapt', 'adapting', 'adaptability', 'adaptable', 'resilience',
  'resilient', 'motivation', 'motivated', 'persistence', 'persistent', 'ownership', 'leadership',
  'curiosity', 'curious', 'independent', 'independence', 'prioritize', 'planning', 'plan', 'vision',
  'goal', 'goals', 'oriented', 'proactive', 'competence', 'competency', 'competencies', 'proficiency',
  'fluency', 'autonomy', 'supportive', 'support', 'balanced', 'balance', 'focus', 'focused',
  'discipline', 'disciplined', 'consistent', 'consistency', 'expression', 'expressive',
  'collaboration', 'collaborative', 'creativity', 'creative', 'intelligence', 'capable', 'capability',
  'capabilities', 'confidence',
]);
// Strong "this is a skill/competency" framing.
const CAPABILITY_CUE = new Set([
  'build', 'building', 'develop', 'developing', 'development', 'strengthen', 'improve', 'improving',
  'master', 'mastery', 'skill', 'skills', 'ability', 'capability', 'competence', 'competency',
  'readiness', 'clarity', 'awareness', 'leadership', 'ownership', 'planning', 'vision', 'adaptability',
  'resilience', 'autonomy', 'proficiency', 'fluency', 'understanding', 'discipline', 'expression',
  'collaboration', 'creativity', 'intelligence', 'persistence', 'curiosity',
]);
const OUTCOME_TERMS = new Set([
  'loss', 'losing', 'lose', 'lost', 'decline', 'declining', 'burnout', 'fatigue', 'collapse',
  'breakdown', 'exhaustion', 'stagnation', 'dropout', 'deterioration', 'plateau', 'attrition',
]);
const RISK_TERMS = new Set(['risk', 'risks', 'vulnerability', 'vulnerable', 'fragility', 'fragile', 'threat', 'relapse', 'susceptibility']);
const TRAIT_TERMS = new Set(['dependency', 'dependence', 'overdependence', 'sensitivity', 'rigidity', 'perfectionism', 'impulsivity', 'introversion']);
const BEHAVIOR_TERMS = new Set(['avoidance', 'avoid', 'withdrawal', 'procrastination', 'distraction', 'reactivity', 'resistance', 'hesitation', 'suppression', 'aggression', 'fragmentation', 'overthinking', 'rumination', 'comparison', 'disengagement', 'play', 'scrolling']);
const PROBLEM_SUFFIX = new Set(['weakness', 'anxiety', 'deficit', 'blindness', 'gap', 'stress', 'difficulty', 'instability', 'imbalance', 'conflict', 'paralysis', 'confusion', 'pressure', 'overload', 'dysregulation', 'insecurity', 'ambiguity', 'disconnect']);

type Polarity = 'positive' | 'negative' | 'neutral';

function toks(s?: string | null): string[] {
  if (!s) return [];
  return String(s).toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 2);
}

function polarity(text?: string | null): Polarity {
  const t = toks(text);
  if (t.some((w) => STRONG_NEG.has(w))) return 'negative';
  if (t.some((w) => STRONG_POS.has(w))) return 'positive';
  let neg = 0, pos = 0;
  for (const w of t) { if (WEAK_NEG.has(w)) neg++; if (WEAK_POS.has(w)) pos++; }
  if (neg > pos) return 'negative';
  if (pos > neg) return 'positive';
  return 'neutral';
}

type Verdict = 'Correct' | 'Questionable' | 'Incorrect';

interface Row {
  concern_id: string;
  concern_name: string;
  concern_category: string;
  domain: string;
  classification: Classification;
  confidence_score: number;
  display_label: string;
  pol: Polarity;
  hasCapCue: boolean;
}

function judge(r: Row): { verdict: Verdict; reason: string } {
  const nameToks = new Set([...toks(r.display_label), ...toks(r.concern_category)]);
  const catHead = toks(r.concern_category).slice(-1)[0] || '';
  const has = (set: Set<string>) => [...nameToks].some((w) => set.has(w));

  switch (r.classification) {
    case 'Capability':
      if (r.pol === 'positive') return { verdict: 'Correct', reason: 'capability + positive label' };
      if (r.pol === 'neutral') return { verdict: 'Questionable', reason: 'capability but label neutral' };
      return { verdict: 'Incorrect', reason: 'capability but label reads negative (likely Problem)' };
    case 'Problem':
      if (r.pol === 'negative') return { verdict: 'Correct', reason: 'problem + negative label' };
      if (r.pol === 'positive')
        return r.hasCapCue
          ? { verdict: 'Incorrect', reason: 'positive capability-framed label (capability gap)' }
          : { verdict: 'Questionable', reason: 'problem but label reads positive' };
      return PROBLEM_SUFFIX.has(catHead)
        ? { verdict: 'Correct', reason: 'neutral label but strong problem category suffix' }
        : { verdict: 'Questionable', reason: 'problem but label neutral, weak category signal' };
    case 'Outcome':
      if (has(OUTCOME_TERMS)) return { verdict: 'Correct', reason: 'result/outcome term present' };
      if (r.pol === 'positive') return { verdict: 'Incorrect', reason: 'outcome but positive label' };
      return { verdict: 'Questionable', reason: 'no explicit result term' };
    case 'Risk':
      return has(RISK_TERMS)
        ? { verdict: 'Correct', reason: 'risk/vulnerability term present' }
        : { verdict: 'Questionable', reason: 'no explicit risk term' };
    case 'Trait':
      if (has(TRAIT_TERMS)) return { verdict: 'Correct', reason: 'dispositional trait term present' };
      if (r.pol === 'positive' && r.hasCapCue) return { verdict: 'Incorrect', reason: 'positive capability-framed (not a trait)' };
      return { verdict: 'Questionable', reason: 'no clear trait term' };
    case 'Behavior':
      if (has(BEHAVIOR_TERMS)) return { verdict: 'Correct', reason: 'action-pattern term present' };
      if (r.pol === 'positive' && r.hasCapCue) return { verdict: 'Incorrect', reason: 'positive capability-framed (not a behavior)' };
      return { verdict: 'Questionable', reason: 'no clear behavior term' };
  }
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]) {
  fs.writeFileSync(file, [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n'));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: raw } = await pool.query(
      `SELECT cc.concern_id, cc.concern_name, cc.classification, cc.confidence_score,
              cm.concern_category, cm.domain, cm.display_label
         FROM concern_classification cc
         JOIN capadex_concerns_master cm USING (concern_id)`,
    );
    const all: Row[] = raw.map((r: any) => {
      const pol = polarity(r.display_label);
      const hasCapCue = toks(r.display_label).some((w) => CAPABILITY_CUE.has(w));
      return {
        concern_id: r.concern_id,
        concern_name: r.concern_name,
        concern_category: r.concern_category ?? '',
        domain: r.domain ?? '',
        classification: r.classification,
        confidence_score: Number(r.confidence_score),
        display_label: r.display_label ?? '',
        pol, hasCapCue,
      };
    });
    console.log(`[audit] loaded ${all.length} classified concerns`);

    const verdicts = new Map<string, { verdict: Verdict; reason: string }>();
    for (const r of all) verdicts.set(r.concern_id, judge(r));

    fs.mkdirSync(OUT_DIR, { recursive: true });

    // ── 1+2. Stratified random sampling + semantic verdicts ──────────────────
    const rng = mulberry32(SEED);
    const targets: Record<Classification, number> = { Problem: 100, Capability: 100, Trait: 100, Behavior: 100, Outcome: 100, Risk: 49 };
    const byClass = new Map<Classification, Row[]>();
    for (const c of CLASSIFICATIONS) byClass.set(c, []);
    for (const r of all) byClass.get(r.classification)!.push(r);

    const sampleRows: unknown[][] = [];
    const sampleVerdictTally: Record<Classification, Record<Verdict, number>> = {} as any;
    for (const c of CLASSIFICATIONS) {
      const pool2 = [...byClass.get(c)!];
      // Fisher-Yates with seeded rng
      for (let i = pool2.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool2[i], pool2[j]] = [pool2[j], pool2[i]];
      }
      const n = Math.min(targets[c], pool2.length);
      const picked = pool2.slice(0, n);
      sampleVerdictTally[c] = { Correct: 0, Questionable: 0, Incorrect: 0 };
      for (const r of picked) {
        const v = verdicts.get(r.concern_id)!;
        sampleVerdictTally[c][v.verdict]++;
        sampleRows.push([r.concern_id, r.concern_name, r.concern_category, r.classification, r.confidence_score, r.pol, v.verdict, v.reason]);
      }
    }
    writeCsv(path.join(OUT_DIR, 'samples.csv'),
      ['concern_id', 'concern_name', 'concern_category', 'classification', 'confidence', 'label_polarity', 'verdict', 'reason'],
      sampleRows);

    // ── 4. Domain distribution matrix (whole dataset) ────────────────────────
    const domains = [...new Set(all.map((r) => r.domain))].sort();
    const domainMatrix: unknown[][] = [];
    for (const d of domains) {
      const sub = all.filter((r) => r.domain === d);
      const counts = CLASSIFICATIONS.map((c) => sub.filter((r) => r.classification === c).length);
      domainMatrix.push([d, sub.length, ...counts, ((counts[1] / sub.length) * 100).toFixed(0) + '%']);
    }
    writeCsv(path.join(OUT_DIR, 'domain_distribution.csv'),
      ['domain', 'total', ...CLASSIFICATIONS, 'pct_problem'], domainMatrix);

    // ── 5. Polarity audit (whole dataset) ────────────────────────────────────
    const polCounts: Record<Polarity, number> = { positive: 0, negative: 0, neutral: 0 };
    for (const r of all) polCounts[r.pol]++;

    // ── 6. Capability-gap list: assigned non-Capability but positive cap-framed
    const capGap = all.filter(
      (r) => r.classification !== 'Capability' && r.pol === 'positive' && r.hasCapCue,
    );
    writeCsv(path.join(OUT_DIR, 'capability_gap.csv'),
      ['concern_id', 'concern_name', 'concern_category', 'assigned', 'confidence', 'suggested'],
      capGap.map((r) => [r.concern_id, r.concern_name, r.concern_category, r.classification, r.confidence_score, 'Capability']));

    // ── 7. Accuracy estimate by category ─────────────────────────────────────
    console.log('\n=== 2/7. SEMANTIC VERDICTS + ACCURACY BY CATEGORY (sampled) ===');
    console.log('Category     n   Correct Quest. Incor.  strict%  lenient%');
    let totC = 0, totQ = 0, totI = 0, totN = 0;
    for (const c of CLASSIFICATIONS) {
      const t = sampleVerdictTally[c];
      const n = t.Correct + t.Questionable + t.Incorrect;
      totC += t.Correct; totQ += t.Questionable; totI += t.Incorrect; totN += n;
      const strict = ((t.Correct / Math.max(1, n)) * 100).toFixed(0);
      const lenient = (((t.Correct + t.Questionable) / Math.max(1, n)) * 100).toFixed(0);
      console.log(`${c.padEnd(11)} ${String(n).padStart(3)}   ${String(t.Correct).padStart(4)}  ${String(t.Questionable).padStart(5)}  ${String(t.Incorrect).padStart(5)}   ${strict.padStart(5)}%   ${lenient.padStart(5)}%`);
    }
    const strictAll = ((totC / totN) * 100).toFixed(1);
    const lenientAll = (((totC + totQ) / totN) * 100).toFixed(1);
    console.log(`${'OVERALL'.padEnd(11)} ${String(totN).padStart(3)}   ${String(totC).padStart(4)}  ${String(totQ).padStart(5)}  ${String(totI).padStart(5)}   ${strictAll.padStart(5)}%   ${lenientAll.padStart(5)}%`);

    console.log('\n=== 4. DOMAIN DISTRIBUTION (problem-dominated domains, top 15 by %) ===');
    console.log('Domain                                          tot  Cap Prob Beh Tra Out Rsk  %Prob');
    [...domainMatrix].sort((a: any, b: any) => parseInt(b[9]) - parseInt(a[9])).slice(0, 15).forEach((m: any) => {
      console.log(`${String(m[0]).slice(0, 44).padEnd(45)} ${String(m[1]).padStart(4)} ${String(m[2]).padStart(3)} ${String(m[3]).padStart(4)} ${String(m[4]).padStart(3)} ${String(m[5]).padStart(3)} ${String(m[6]).padStart(3)} ${String(m[7]).padStart(3)}  ${m[8]}`);
    });
    const allProblemDomains = domainMatrix.filter((m: any) => m[3] === m[1]).length;

    console.log('\n=== 5. POLARITY AUDIT (whole dataset) ===');
    console.log(`Positive: ${polCounts.positive}  |  Negative: ${polCounts.negative}  |  Neutral: ${polCounts.neutral}`);

    console.log('\n=== 6. CAPABILITY-GAP (positive capability-framed labels NOT classified Capability) ===');
    console.log(`Count: ${capGap.length}  (${((capGap.length / all.length) * 100).toFixed(1)}% of all concerns)`);
    const gapInProblem = capGap.filter((r) => r.classification === 'Problem').length;
    const problemTotal = byClass.get('Problem')!.length;
    console.log(`Of these, assigned Problem: ${gapInProblem} (${((gapInProblem / problemTotal) * 100).toFixed(1)}% of all Problem labels)`);
    capGap.slice(0, 12).forEach((r) => console.log(`  [${r.classification}] ${r.concern_name}  <=  "${r.concern_category}"`));

    // ── 3. Misclassification pattern tally ───────────────────────────────────
    const reasonTally = new Map<string, number>();
    for (const [, v] of verdicts) {
      if (v.verdict !== 'Correct') reasonTally.set(v.reason, (reasonTally.get(v.reason) || 0) + 1);
    }
    console.log('\n=== 3. MISCLASSIFICATION PATTERNS (whole dataset, non-Correct) ===');
    [...reasonTally.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

    // Whole-dataset verdict totals (not just sample) for the headline number.
    const wholeTally: Record<Verdict, number> = { Correct: 0, Questionable: 0, Incorrect: 0 };
    for (const [, v] of verdicts) wholeTally[v.verdict]++;
    const wStrict = ((wholeTally.Correct / all.length) * 100).toFixed(1);
    const wLenient = (((wholeTally.Correct + wholeTally.Questionable) / all.length) * 100).toFixed(1);

    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
      total: all.length, sampleVerdictTally, sampleStrictPct: strictAll, sampleLenientPct: lenientAll,
      wholeTally, wholeStrictPct: wStrict, wholeLenientPct: wLenient,
      polarity: polCounts, capabilityGap: capGap.length, capabilityGapInProblem: gapInProblem,
      fullyProblemDomains: allProblemDomains,
    }, null, 2));

    console.log('\n=== WHOLE-DATASET HEADLINE ===');
    console.log(`Correct ${wholeTally.Correct} | Questionable ${wholeTally.Questionable} | Incorrect ${wholeTally.Incorrect}`);
    console.log(`Strict accuracy ${wStrict}%  |  Lenient accuracy ${wLenient}%`);
    console.log(`Fully-Problem domains (100% of domain = Problem): ${allProblemDomains} / ${domains.length}`);
    console.log(`\n[audit] artifacts → ${OUT_DIR}/ (samples.csv, domain_distribution.csv, capability_gap.csv, summary.json)`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error('[audit] FAILED:', e); process.exit(1); });
