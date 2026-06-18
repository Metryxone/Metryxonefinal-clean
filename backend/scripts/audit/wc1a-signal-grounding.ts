// WC-1A — Signal Grounding Audit (INVESTIGATION ONLY, read-only).
// Can existing atomic signals be REUSED to ground the ~300 signal-less bridge tags?
// Does NOT modify ontology / create signals / create tags / create concerns.
// Run: cd backend && npx tsx scripts/audit/wc1a-signal-grounding.ts
//
// Method: the atomic-signal pool is semantically rich (370 families x 20 domains) but
// bridge-tag-labelled into ~28 mostly catch-all buckets. We match each bridge tag's
// CONCERN corpus to existing signal FAMILIES via IDF-weighted cosine over shared tokens,
// then the candidate reusable atomic signals are the members of the best-matching families.
// Thresholds are CALIBRATED against the 25 already-grounded tags (known-good matches).
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../../audit/wc1a');

const PRIORITY = [
  'Career Clarity', 'Leadership', 'Communication', 'Decision Making', 'Entrepreneurship',
  'Future Readiness', 'Learning Mindset', 'Self Awareness', 'Career Exploration', 'Career Stability',
];
const PRIORITY_TAG: Record<string, string> = {
  'Career Clarity': 'CAREER_CLARITY', 'Leadership': 'LEADERSHIP', 'Communication': 'COMMUNICATION',
  'Decision Making': 'DECISION_MAKING', 'Entrepreneurship': 'ENTREPRENEURSHIP', 'Future Readiness': 'FUTURE_READINESS',
  'Learning Mindset': 'LEARNING_MINDSET', 'Self Awareness': 'SELF_AWARENESS',
  'Career Exploration': 'CAREER_EXPLORATION', 'Career Stability': 'CAREER_STABILITY',
};
// semantic concern words per priority construct (same as WC-1, for tags that have no dedicated bridge tag)
const PRIORITY_WORDS: Record<string, string[]> = {
  'Career Clarity': ['career clarity', 'career direction', 'career goal', 'unclear career', 'career confusion', 'career'],
  'Leadership': ['leadership', 'leading team', 'team lead', 'ownership', 'manage people', 'delegation', 'influence'],
  'Communication': ['communication', 'communicate', 'express', 'public speaking', 'conversation', 'articulate'],
  'Decision Making': ['decision making', 'decision', 'indecision', 'choosing', 'making choices', 'judgement'],
  'Entrepreneurship': ['entrepreneur', 'startup', 'business venture', 'founder', 'innovation', 'risk taking'],
  'Future Readiness': ['future readiness', 'future ready', 'future proof', 'adaptability', 'prepared for future', 'change'],
  'Learning Mindset': ['learning mindset', 'growth mindset', 'love of learning', 'curiosity', 'learning drive', 'learning'],
  'Self Awareness': ['self awareness', 'self-aware', 'know myself', 'self reflection', 'introspection', 'identity'],
  'Career Exploration': ['career exploration', 'explore career', 'career option', 'career path', 'exploration'],
  'Career Stability': ['career stability', 'job security', 'career security', 'stable career', 'stability'],
};

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'has', 'have', 'not', 'but', 'you', 'your', 'when', 'how', 'why', 'what', 'who', 'too', 'can', 'from', 'into', 'about', 'over', 'under', 'out', 'off', 'all', 'any', 'more', 'most', 'other', 'some', 'such', 'own', 'same', 'than', 'then', 'them', 'they', 'their', 'will', 'would', 'should', 'could', 'signals', 'signal', 'general', 'concern', 'concerns', 'related', 'level', 'low', 'high']);
function tokens(s: string): string[] {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
    .map((t) => t.replace(/(ing|ed|es|s)$/i, (m) => (t.length - m.length >= 3 ? '' : m)))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}
const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const esc = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const pctile = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0; };

interface Vec { v: Map<string, number>; norm: number; }
function buildVec(toks: string[], idf: Map<string, number>): Vec {
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
  const v = new Map<string, number>();
  for (const [t, c] of tf) v.set(t, (1 + Math.log(c)) * (idf.get(t) || 0));
  let n = 0; for (const w of v.values()) n += w * w;
  return { v, norm: Math.sqrt(n) || 1 };
}
function cosine(a: Vec, b: Vec): { sim: number; shared: string[] } {
  let dot = 0; const shared: { t: string; w: number }[] = [];
  const [sm, lg] = a.v.size < b.v.size ? [a, b] : [b, a];
  for (const [t, w] of sm.v) { const w2 = lg.v.get(t); if (w2) { dot += w * w2; shared.push({ t, w: w * w2 }); } }
  shared.sort((x, y) => y.w - x.w);
  return { sim: dot / (a.norm * b.norm), shared: shared.slice(0, 6).map((s) => s.t) };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(OUT, { recursive: true });

  // ---- atomic signals -> family profiles ----
  const atomic = (await pool.query(
    `SELECT atomic_signal_name, signal_label, signal_category, family_name, domain_name,
            relational_bridge_tag, severity_weight FROM capadex_atomic_signals`)).rows as any[];
  interface Fam { family: string; domain: string; count: number; tokenBag: string[]; names: { n: string; sev: number }[]; }
  const fams = new Map<string, Fam>();
  for (const r of atomic) {
    const key = r.family_name;
    if (!fams.has(key)) fams.set(key, { family: r.family_name, domain: r.domain_name, count: 0, tokenBag: [], names: [] });
    const f = fams.get(key)!;
    f.count++;
    f.tokenBag.push(...tokens(`${r.family_name} ${r.domain_name} ${r.atomic_signal_name} ${r.signal_label} ${r.signal_category}`));
    f.names.push({ n: r.signal_label || r.atomic_signal_name, sev: +r.severity_weight || 0 });
  }
  // family IDF
  const df = new Map<string, number>();
  for (const f of fams.values()) for (const t of new Set(f.tokenBag)) df.set(t, (df.get(t) || 0) + 1);
  const NF = fams.size;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((1 + NF) / (1 + d)) + 1);
  const famVecs = new Map<string, { fam: Fam; vec: Vec }>();
  for (const f of fams.values()) famVecs.set(f.family, { fam: f, vec: buildVec(f.tokenBag, idf) });

  // ---- concerns / tags ----
  const concerns = (await pool.query(`SELECT concern_id, relational_bridge_tag tag, display_label, concern_cluster FROM capadex_concerns_master`)).rows as any[];
  const sigByTag = new Map<string, number>();
  for (const r of atomic) if (r.relational_bridge_tag) sigByTag.set(r.relational_bridge_tag, (sigByTag.get(r.relational_bridge_tag) || 0) + 1);
  const qByTag = new Map<string, number>();
  for (const r of (await pool.query(`SELECT master_bridge_tag t, count(*) c FROM capadex_clarity_questions WHERE master_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[]) qByTag.set(r.t, +r.c);
  const tier3ByTag = new Map<string, number>();
  for (const r of (await pool.query(`SELECT relational_bridge_tag t, count(*) c FROM capadex_concern_signal_map WHERE signal_tier='tier3' AND relational_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[]) tier3ByTag.set(r.t, +r.c);

  // tag -> concern corpus
  const tagConcerns = new Map<string, any[]>();
  for (const c of concerns) { if (!c.tag) continue; if (!tagConcerns.has(c.tag)) tagConcerns.set(c.tag, []); tagConcerns.get(c.tag)!.push(c); }

  function tagVec(tag: string, cs: any[]): Vec {
    const bag = [...tokens(tag)];
    for (const c of cs) bag.push(...tokens(`${c.display_label} ${c.concern_cluster}`));
    return buildVec(bag, idf);
  }
  function bestFamilies(vec: Vec, k: number) {
    const scored = [...famVecs.values()].map(({ fam, vec: fv }) => { const { sim, shared } = cosine(vec, fv); return { family: fam.family, domain: fam.domain, count: fam.count, sim, shared, names: fam.names }; });
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, k);
  }

  // ---- calibration: 25 grounded tags' best-family sim (known-good) ----
  const groundedTags = [...sigByTag.keys()].filter((t) => tagConcerns.has(t));
  const groundedBest: number[] = [];
  for (const t of groundedTags) { const bf = bestFamilies(tagVec(t, tagConcerns.get(t)!), 1)[0]; if (bf) groundedBest.push(bf.sim); }
  const TAU_HIGH = Math.max(0.06, +pctile(groundedBest, 0.25).toFixed(4)); // GREEN
  const TAU_LOW = +(TAU_HIGH * 0.45).toFixed(4); // YELLOW floor
  const MIN_CAND = 3;

  // ---- score every bridge tag ----
  interface Row {
    bridge_tag: string; concern_count: number; current_signal_count: number; tier3_links: number; question_count: number;
    candidate_signal_count: number; best_family: string; best_domain: string; best_similarity: number; second_family: string;
    semantic_overlap: string; evidence_strength: string; classification: string; already_grounded: boolean;
    relationship_path: string; candidate_examples: string;
  }
  const rows: Row[] = [];
  for (const [tag, cs] of tagConcerns) {
    const vec = tagVec(tag, cs);
    const top = bestFamilies(vec, 3);
    const best = top[0];
    const candCount = top.filter((f) => f.sim >= TAU_LOW).reduce((s, f) => s + f.count, 0);
    const grounded = (sigByTag.get(tag) || 0) > 0;
    const sim = best ? best.sim : 0;
    let cls: string;
    if (grounded) cls = 'ALREADY_GROUNDED';
    else if (sim >= TAU_HIGH && candCount >= MIN_CAND) cls = 'GREEN';
    else if (sim >= TAU_LOW) cls = 'YELLOW';
    else cls = 'RED';
    const ev = sim >= TAU_HIGH ? 'strong' : sim >= TAU_LOW ? 'moderate' : 'weak';
    const examples = best ? [...new Set(best.names.sort((a, b) => b.sev - a.sev).map((n) => n.n))].slice(0, 6).join(' | ') : '';
    rows.push({
      bridge_tag: tag, concern_count: cs.length, current_signal_count: sigByTag.get(tag) || 0,
      tier3_links: tier3ByTag.get(tag) || 0, question_count: qByTag.get(tag) || 0,
      candidate_signal_count: candCount, best_family: best?.family || '', best_domain: best?.domain || '',
      best_similarity: +sim.toFixed(4), second_family: top[1]?.family || '',
      semantic_overlap: best?.shared.join(' ') || '', evidence_strength: ev, classification: cls, already_grounded: grounded,
      relationship_path: best ? `${tag} -> domain:${best.domain} -> family:${best.family} -> ${best.count} atomic signals` : '',
      candidate_examples: examples,
    });
  }
  rows.sort((a, b) => b.concern_count - a.concern_count);

  // ---- 1. Signal Grounding Matrix ----
  const gmHdr = 'bridge_tag,concern_count,current_signal_count,tier3_links,question_count,candidate_signal_count,best_family,best_domain,best_similarity,evidence_strength,classification';
  fs.writeFileSync(path.join(OUT, 'signal_grounding_matrix.csv'),
    [gmHdr, ...rows.map((r) => [r.bridge_tag, r.concern_count, r.current_signal_count, r.tier3_links, r.question_count, r.candidate_signal_count, esc(r.best_family), esc(r.best_domain), r.best_similarity, r.evidence_strength, r.classification].join(','))].join('\n'));

  // ---- 2. Candidate Signal Reuse Map (signal-less tags only, top-3 families) ----
  const reuse: string[] = ['bridge_tag,concern_count,classification,rank,candidate_family,domain,family_signal_count,similarity,shared_tokens,example_signals,relationship_path'];
  for (const r of rows.filter((x) => !x.already_grounded)) {
    const top = bestFamilies(tagVec(r.bridge_tag, tagConcerns.get(r.bridge_tag)!), 3);
    top.forEach((f, i) => {
      const ex = [...new Set(f.names.sort((a, b) => b.sev - a.sev).map((n) => n.n))].slice(0, 5).join(' | ');
      reuse.push([r.bridge_tag, r.concern_count, r.classification, i + 1, esc(f.family), esc(f.domain), f.count, +f.sim.toFixed(4), esc(f.shared.join(' ')), esc(ex), esc(`${r.bridge_tag} -> ${f.domain} -> ${f.family}`)].join(','));
    });
  }
  fs.writeFileSync(path.join(OUT, 'candidate_signal_reuse_map.csv'), reuse.join('\n'));

  // ---- 3. Signal Gap Report (RED tags = need new signals) ----
  const red = rows.filter((r) => r.classification === 'RED').sort((a, b) => b.concern_count - a.concern_count);
  const gap: string[] = ['bridge_tag,concern_count,question_count,best_similarity,best_family,reason'];
  for (const r of red) gap.push([r.bridge_tag, r.concern_count, r.question_count, r.best_similarity, esc(r.best_family), esc('no existing family clears reuse threshold (' + TAU_LOW + ') -> requires new signals')].join(','));
  fs.writeFileSync(path.join(OUT, 'signal_gap_report.csv'), gap.join('\n'));

  // ---- 4/5. Forecasts ----
  const totalTags = rows.length;
  const totalConcerns = rows.reduce((s, r) => s + r.concern_count, 0);
  const count = (cls: string) => rows.filter((r) => r.classification === cls).length;
  const concernsOf = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((s, r) => s + r.concern_count, 0);
  const grounded = rows.filter((r) => r.already_grounded).length;
  const green = count('GREEN'), yellow = count('YELLOW'), redN = count('RED');

  const currentCovTags = +(100 * grounded / totalTags).toFixed(1);
  const potCovGreen = +(100 * (grounded + green) / totalTags).toFixed(1);
  const potCovGreenYellow = +(100 * (grounded + green + yellow) / totalTags).toFixed(1);
  const currentCovConcerns = +(100 * concernsOf((r) => r.already_grounded) / totalConcerns).toFixed(1);
  const potCovConcernsGreen = +(100 * concernsOf((r) => r.already_grounded || r.classification === 'GREEN') / totalConcerns).toFixed(1);
  const potCovConcernsGY = +(100 * concernsOf((r) => r.already_grounded || r.classification === 'GREEN' || r.classification === 'YELLOW') / totalConcerns).toFixed(1);

  // WC-1 layer scores (signal layer = tag-coverage %); recompute health by swapping signal layer
  const WC1_LAYERS = { signal: currentCovTags, question: 99.1, capability: 36.4, problem: 36.4, behavior: 100, archetype: 86.4, intervention: 86.4, recommendation: 34.5 };
  const healthWith = (sig: number) => +(((sig + WC1_LAYERS.question + WC1_LAYERS.capability + WC1_LAYERS.problem + WC1_LAYERS.behavior + WC1_LAYERS.archetype + WC1_LAYERS.intervention + WC1_LAYERS.recommendation) / 8)).toFixed(1);
  const healthNow = healthWith(currentCovTags);
  const healthGreen = healthWith(potCovGreen);
  const healthGY = healthWith(potCovGreenYellow);

  // soft estimates (directional, labelled)
  const questionsTotal = [...qByTag.values()].reduce((a, b) => a + b, 0);
  const questionsUnderGreen = rows.filter((r) => r.classification === 'GREEN').reduce((s, r) => s + r.question_count, 0);
  const questionsUnderGY = rows.filter((r) => r.classification === 'GREEN' || r.classification === 'YELLOW').reduce((s, r) => s + r.question_count, 0);

  const forecast = {
    generated_at: new Date().toISOString(), investigation_only: true, ontology_modified: false,
    new_signals_created: 0, new_tags_created: 0, new_concerns_created: 0,
    calibration: { grounded_tags: groundedTags.length, grounded_best_sim_p25: +pctile(groundedBest, 0.25).toFixed(4), grounded_best_sim_median: +pctile(groundedBest, 0.5).toFixed(4), TAU_HIGH_green: TAU_HIGH, TAU_LOW_yellow: TAU_LOW, min_candidate_signals: MIN_CAND },
    classification_counts: { ALREADY_GROUNDED: grounded, GREEN: green, YELLOW: yellow, RED: redN, total_tags: totalTags },
    coverage_forecast: {
      current_coverage_tags_pct: currentCovTags, potential_coverage_green_pct: potCovGreen, potential_coverage_green_yellow_pct: potCovGreenYellow,
      coverage_gain_green_pct: +(potCovGreen - currentCovTags).toFixed(1), coverage_gain_green_yellow_pct: +(potCovGreenYellow - currentCovTags).toFixed(1),
      current_coverage_concerns_pct: currentCovConcerns, potential_coverage_concerns_green_pct: potCovConcernsGreen, potential_coverage_concerns_green_yellow_pct: potCovConcernsGY,
    },
    ontology_health_forecast: { current: healthNow, potential_green: healthGreen, potential_green_yellow: healthGY, gain_green: +(healthGreen - healthNow).toFixed(1), gain_green_yellow: +(healthGY - healthNow).toFixed(1), note: 'health = mean of WC-1 8 layers with the signal layer swapped for forecast signal coverage; other 7 layers held at WC-1 values' },
    resolver_gain_estimate: { basis: 'concerns moved from signal-less to signal-grounded', concerns_newly_grounded_green: concernsOf((r) => r.classification === 'GREEN'), concerns_newly_grounded_green_yellow: concernsOf((r) => r.classification === 'GREEN' || r.classification === 'YELLOW'), note: 'directional estimate: grounded concerns gain tier-3 signal evidence the resolver/confidence engine can consume; not a measured accuracy delta' },
    question_quality_gain_estimate: { questions_total: questionsTotal, questions_under_green_tags: questionsUnderGreen, questions_under_green_yellow_tags: questionsUnderGY, pct_questions_addressable_green: +(100 * questionsUnderGreen / questionsTotal).toFixed(1), note: 'directional estimate: clarity questions under newly-groundable tags become signal-targetable; not a measured quality score' },
  };
  fs.writeFileSync(path.join(OUT, 'coverage_health_forecast.json'), JSON.stringify(forecast, null, 2));

  // ---- 6. Top 100 highest-impact grounding opportunities ----
  const opps = rows.filter((r) => !r.already_grounded && (r.classification === 'GREEN' || r.classification === 'YELLOW'))
    .map((r) => ({ ...r, impact: +(r.concern_count * r.best_similarity * (r.classification === 'GREEN' ? 1 : 0.5)).toFixed(3) }))
    .sort((a, b) => b.impact - a.impact).slice(0, 100);
  const oppHdr = 'rank,bridge_tag,concern_count,question_count,classification,best_family,best_domain,best_similarity,candidate_signal_count,impact_score,relationship_path,candidate_examples';
  fs.writeFileSync(path.join(OUT, 'top_100_grounding_opportunities.csv'),
    [oppHdr, ...opps.map((r, i) => [i + 1, r.bridge_tag, r.concern_count, r.question_count, r.classification, esc(r.best_family), esc(r.best_domain), r.best_similarity, r.candidate_signal_count, r.impact, esc(r.relationship_path), esc(r.candidate_examples)].join(','))].join('\n'));

  // ---- priority construct classification (Phase 3) ----
  const priorityReport: any[] = [];
  for (const name of PRIORITY) {
    const TAG = PRIORITY_TAG[name];
    const dedicated = rows.find((r) => r.bridge_tag === TAG);
    // if no dedicated tag, build a semantic concern set + score against families
    let cls: string, sim: number, fam: string, dom: string, candCount: number, ccount: number, examples: string, path: string;
    if (dedicated) {
      cls = dedicated.already_grounded ? 'ALREADY_GROUNDED' : dedicated.classification;
      sim = dedicated.best_similarity; fam = dedicated.best_family; dom = dedicated.best_domain;
      candCount = dedicated.candidate_signal_count; ccount = dedicated.concern_count;
      examples = dedicated.candidate_examples; path = dedicated.relationship_path;
    } else {
      const words = PRIORITY_WORDS[name];
      const sem = concerns.filter((c) => { const h = `${c.display_label || ''} ${c.concern_cluster || ''}`.toLowerCase(); return words.some((w) => h.includes(w)); });
      const vec = buildVec([...tokens(TAG), ...words.flatMap((w) => tokens(w)), ...sem.flatMap((c) => tokens(`${c.display_label} ${c.concern_cluster}`))], idf);
      const top = bestFamilies(vec, 3);
      const best = top[0];
      sim = best ? best.sim : 0; fam = best?.family || ''; dom = best?.domain || '';
      candCount = top.filter((f) => f.sim >= TAU_LOW).reduce((s, f) => s + f.count, 0); ccount = sem.length;
      cls = sim >= TAU_HIGH && candCount >= MIN_CAND ? 'GREEN' : sim >= TAU_LOW ? 'YELLOW' : 'RED';
      examples = best ? [...new Set(best.names.sort((a, b) => b.sev - a.sev).map((n) => n.n))].slice(0, 6).join(' | ') : '';
      path = best ? `${name} (semantic) -> ${dom} -> ${fam} -> ${best.count} atomic signals` : '';
    }
    priorityReport.push({ construct: name, target_tag: TAG, has_dedicated_tag: !!dedicated, concern_count: ccount, classification: cls, best_family: fam, best_domain: dom, best_similarity: +sim.toFixed(4), candidate_signal_count: candCount, candidate_examples: examples, relationship_path: path });
  }
  fs.writeFileSync(path.join(OUT, 'priority_construct_grounding.csv'),
    ['construct,target_tag,has_dedicated_tag,concern_count,classification,best_family,best_domain,best_similarity,candidate_signal_count,relationship_path',
      ...priorityReport.map((p) => [esc(p.construct), p.target_tag, p.has_dedicated_tag, p.concern_count, p.classification, esc(p.best_family), esc(p.best_domain), p.best_similarity, p.candidate_signal_count, esc(p.relationship_path)].join(','))].join('\n'));

  fs.writeFileSync(path.join(OUT, 'priority_construct_grounding.json'), JSON.stringify(priorityReport, null, 2));

  console.log('calibration: grounded p25=', forecast.calibration.grounded_best_sim_p25, 'TAU_HIGH=', TAU_HIGH, 'TAU_LOW=', TAU_LOW);
  console.log('classification:', JSON.stringify(forecast.classification_counts));
  console.log('coverage:', JSON.stringify(forecast.coverage_forecast));
  console.log('health:', JSON.stringify(forecast.ontology_health_forecast));
  console.log('--- priority constructs ---');
  for (const p of priorityReport) console.log(`  ${p.construct.padEnd(20)} ${p.classification.padEnd(16)} sim=${p.best_similarity} fam=${p.best_family} cand=${p.candidate_signal_count}`);
  console.log('wrote', OUT);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
