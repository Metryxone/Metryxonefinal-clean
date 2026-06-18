// WC-1 — Construct Coverage & Ontology Audit (INVESTIGATION ONLY, read-only).
// Does NOT modify the ontology. Run: npx tsx scripts/audit/wc1-ontology-audit.ts
//
// Linkage facts (verified, see .agents/memory/knowledge-graph-linkages.md):
//   bridge tag hub  = capadex_concerns_master.relational_bridge_tag
//                   = capadex_atomic_signals.relational_bridge_tag
//                   = capadex_clarity_questions.master_bridge_tag
//   concern_id keys = behavior_library.concern_id, archetype_concern_map.concern_id,
//                     capability_problem_map.{capability,problem}_concern_id
//   archetype path  = archetype_concern_map.archetype_key -> pil_intervention_library.archetype_key
//   construct path  = recommendation_library.anchor_construct / intervention_library.construct_key
//                     (a SEPARATE ~38-value namespace, runtime-bound, NOT the bridge tags)
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../../audit/wc1');

const MARKETED = [
  'Career Clarity', 'Career Stability', 'Career Exploration', 'Leadership', 'Communication',
  'Entrepreneurship', 'Future Readiness', 'Learning Mindset', 'Decision Making', 'Self Awareness',
];
// keyword sets for semantic concern matching per marketed construct
const MK_WORDS: Record<string, string[]> = {
  'Career Clarity': ['career clarity', 'career direction', 'career goal', 'unclear career', 'career confusion'],
  'Career Stability': ['career stability', 'job security', 'career security', 'stable career'],
  'Career Exploration': ['career exploration', 'explore career', 'career option', 'career path'],
  'Leadership': ['leadership', 'leading team', 'team lead', 'ownership', 'manage people'],
  'Communication': ['communication', 'communicate', 'express', 'public speaking', 'conversation'],
  'Entrepreneurship': ['entrepreneur', 'startup', 'business venture', 'founder'],
  'Future Readiness': ['future readiness', 'future ready', 'future proof', 'adaptability', 'prepared for future'],
  'Learning Mindset': ['learning mindset', 'growth mindset', 'love of learning', 'curiosity', 'learning drive'],
  'Decision Making': ['decision making', 'decision', 'indecision', 'choosing', 'making choices'],
  'Self Awareness': ['self awareness', 'self-aware', 'self awareness', 'know myself', 'self reflection'],
};

const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const firstTok = (s: string) => norm(s).split('_')[0];

function constructMatch(tag: string, constructs: Set<string>): string | null {
  const t = norm(tag);
  for (const c of constructs) {
    if (t === c) return c;
    if (t.startsWith(c + '_') || c.startsWith(t + '_')) return c;
    if (firstTok(t) === firstTok(c) && firstTok(t).length >= 4) return c;
  }
  return null;
}

function rag(green: boolean, red: boolean): 'GREEN' | 'YELLOW' | 'RED' { return green ? 'GREEN' : red ? 'RED' : 'YELLOW'; }
const pct = (n: number, d: number) => (d ? +(100 * n / d).toFixed(1) : 0);
const esc = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(OUT, { recursive: true });

  // ---- pull the linkage sets ----
  const concerns = (await pool.query(
    `SELECT concern_id, relational_bridge_tag AS tag, display_label, concern_cluster
       FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`)).rows as any[];
  const sigByTag = new Map<string, number>();
  for (const r of (await pool.query(
    `SELECT relational_bridge_tag t, count(*) c FROM capadex_atomic_signals
       WHERE relational_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[]) sigByTag.set(r.t, +r.c);
  const qByTag = new Map<string, number>();
  for (const r of (await pool.query(
    `SELECT master_bridge_tag t, count(*) c FROM capadex_clarity_questions
       WHERE master_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[]) qByTag.set(r.t, +r.c);

  const capSet = new Set<string>(), probSet = new Set<string>();
  for (const r of (await pool.query(`SELECT capability_concern_id a, problem_concern_id b FROM capability_problem_map`)).rows as any[]) {
    if (r.a) capSet.add(r.a); if (r.b) probSet.add(r.b);
  }
  const behSet = new Set<string>((await pool.query(`SELECT DISTINCT concern_id FROM behavior_library WHERE concern_id IS NOT NULL`)).rows.map((r: any) => r.concern_id));
  const archByConcern = new Map<string, string>();
  for (const r of (await pool.query(`SELECT concern_id, archetype_key FROM archetype_concern_map WHERE concern_id IS NOT NULL`)).rows as any[]) archByConcern.set(r.concern_id, r.archetype_key);
  const archWithInterv = new Set<string>((await pool.query(`SELECT DISTINCT archetype_key FROM pil_intervention_library WHERE archetype_key IS NOT NULL`)).rows.map((r: any) => r.archetype_key));
  const recConstructs = new Set<string>((await pool.query(`SELECT DISTINCT anchor_construct FROM recommendation_library WHERE anchor_construct IS NOT NULL`)).rows.map((r: any) => norm(r.anchor_construct)));
  const intConstructs = new Set<string>((await pool.query(`SELECT DISTINCT construct_key FROM intervention_library WHERE construct_key IS NOT NULL`)).rows.map((r: any) => norm(r.construct_key)));

  // ---- per-tag aggregation ----
  const tags = new Map<string, any[]>();
  for (const c of concerns) { if (!tags.has(c.tag)) tags.set(c.tag, []); tags.get(c.tag)!.push(c); }

  interface TagRow {
    bridge_tag: string; concern_count: number; signal_count: number; question_count: number;
    capability_cov: number; problem_cov: number; behavior_cov: number; archetype_cov: number;
    intervention_cov: number; recommendation_present: number; intervention_construct_present: number;
    matched_construct: string; missing_layers: number;
  }
  const tagRows: TagRow[] = [];
  for (const [tag, cs] of tags) {
    const n = cs.length;
    const cap = cs.filter((c) => capSet.has(c.concern_id)).length;
    const prob = cs.filter((c) => probSet.has(c.concern_id)).length;
    const beh = cs.filter((c) => behSet.has(c.concern_id)).length;
    const arch = cs.filter((c) => archByConcern.has(c.concern_id)).length;
    const interv = cs.filter((c) => { const a = archByConcern.get(c.concern_id); return a && archWithInterv.has(a); }).length;
    const recMatch = constructMatch(tag, recConstructs);
    const intMatch = constructMatch(tag, intConstructs);
    const signal = sigByTag.get(tag) || 0;
    const question = qByTag.get(tag) || 0;
    const layersPresent = [signal > 0, question > 0, cap > 0, prob > 0, beh > 0, arch > 0, interv > 0, !!recMatch].filter(Boolean).length;
    tagRows.push({
      bridge_tag: tag, concern_count: n, signal_count: signal, question_count: question,
      capability_cov: pct(cap, n), problem_cov: pct(prob, n), behavior_cov: pct(beh, n), archetype_cov: pct(arch, n),
      intervention_cov: pct(interv, n), recommendation_present: recMatch ? 1 : 0, intervention_construct_present: intMatch ? 1 : 0,
      matched_construct: recMatch || intMatch || '', missing_layers: 8 - layersPresent,
    });
  }
  tagRows.sort((a, b) => b.concern_count - a.concern_count);

  // ---- coverage matrix CSV ----
  const matrixCsv = ['bridge_tag,concern_count,signal_count,question_count,capability_cov_pct,problem_cov_pct,behavior_cov_pct,archetype_cov_pct,intervention_cov_pct,recommendation_present,intervention_construct_present,matched_construct,missing_layers'];
  for (const r of tagRows) matrixCsv.push([r.bridge_tag, r.concern_count, r.signal_count, r.question_count, r.capability_cov, r.problem_cov, r.behavior_cov, r.archetype_cov, r.intervention_cov, r.recommendation_present, r.intervention_construct_present, r.matched_construct, r.missing_layers].join(','));
  fs.writeFileSync(path.join(OUT, 'bridge_tag_coverage_matrix.csv'), matrixCsv.join('\n'));

  // ---- ontology health score (volume-weighted across layers) ----
  const totalConcerns = concerns.length;
  const wAvg = (sel: (r: TagRow) => number) => +(tagRows.reduce((s, r) => s + sel(r) * r.concern_count, 0) / totalConcerns).toFixed(1);
  const tagsWith = (sel: (r: TagRow) => boolean) => tagRows.filter(sel).length;
  const layerScores = {
    signal: pct(tagsWith((r) => r.signal_count > 0), tagRows.length),
    question: pct(tagsWith((r) => r.question_count > 0), tagRows.length),
    capability: wAvg((r) => r.capability_cov),
    problem: wAvg((r) => r.problem_cov),
    behavior: wAvg((r) => r.behavior_cov),
    archetype: wAvg((r) => r.archetype_cov),
    intervention: wAvg((r) => r.intervention_cov),
    recommendation: pct(tagsWith((r) => r.recommendation_present === 1), tagRows.length),
  };
  const healthScore = +(Object.values(layerScores).reduce((a, b) => a + b, 0) / Object.keys(layerScores).length).toFixed(1);
  const healthRag = healthScore >= 70 ? 'GREEN' : healthScore >= 40 ? 'YELLOW' : 'RED';

  // ---- marketed construct coverage matrix ----
  const allConcerns = (await pool.query(`SELECT concern_id, relational_bridge_tag tag, display_label, concern_cluster FROM capadex_concerns_master`)).rows as any[];
  const constructReport: any[] = [];
  for (const name of MARKETED) {
    const TAG = norm(name);
    const tagConcerns = allConcerns.filter((c) => norm(c.tag || '') === TAG);
    const words = MK_WORDS[name];
    const semConcerns = allConcerns.filter((c) => {
      const hay = `${c.display_label || ''} ${c.concern_cluster || ''}`.toLowerCase();
      return words.some((w) => hay.includes(w));
    });
    const beh = semConcerns.filter((c) => behSet.has(c.concern_id)).length;
    const arch = semConcerns.filter((c) => archByConcern.has(c.concern_id)).length;
    const cap = semConcerns.filter((c) => capSet.has(c.concern_id)).length;
    const sigForTag = sigByTag.get(TAG) || 0;
    const qForTag = qByTag.get(TAG) || 0;
    const recC = constructMatch(TAG, recConstructs);
    const intC = constructMatch(TAG, intConstructs);
    const hasTag = tagConcerns.length > 0;
    const hasSemantic = semConcerns.length > 0;
    // GREEN = first-class: dedicated tag + signals + questions + behaviour + archetype + (rec OR intervention construct).
    // (No marketed construct currently has dedicated atomic signals under its bridge tag -> GREEN is intentionally unreachable; that is the headline finding.)
    const green = hasTag && sigForTag > 0 && qForTag > 0 && beh > 0 && arch > 0 && (!!recC || !!intC);
    // RED = no first-class presence at all: no dedicated tag AND no dedicated questions AND no construct-level rec/intervention.
    const red = !hasTag && qForTag === 0 && !recC && !intC;
    constructReport.push({
      construct: name, status: rag(green, red),
      has_dedicated_bridge_tag: hasTag, dedicated_tag_concerns: tagConcerns.length,
      semantic_concerns: semConcerns.length, signal_count_for_tag: sigForTag, question_count_for_tag: qForTag,
      behavior_cov_pct: pct(beh, semConcerns.length || 1), archetype_cov_pct: pct(arch, semConcerns.length || 1),
      capability_cov_pct: pct(cap, semConcerns.length || 1),
      recommendation_construct: recC || '', intervention_construct: intC || '',
    });
  }
  const cmCsv = ['construct,status,has_dedicated_bridge_tag,dedicated_tag_concerns,semantic_concerns,signal_count_for_tag,question_count_for_tag,behavior_cov_pct,archetype_cov_pct,capability_cov_pct,recommendation_construct,intervention_construct'];
  for (const c of constructReport) cmCsv.push([c.construct, c.status, c.has_dedicated_bridge_tag, c.dedicated_tag_concerns, c.semantic_concerns, c.signal_count_for_tag, c.question_count_for_tag, c.behavior_cov_pct, c.archetype_cov_pct, c.capability_cov_pct, c.recommendation_construct, c.intervention_construct].map(esc).join(','));
  fs.writeFileSync(path.join(OUT, 'construct_coverage_matrix.csv'), cmCsv.join('\n'));

  // ---- Top 50 Missing Constructs (tags with concerns but most missing downstream layers) ----
  const missing = [...tagRows]
    .filter((r) => r.missing_layers > 0)
    .sort((a, b) => (b.missing_layers - a.missing_layers) || (b.concern_count - a.concern_count))
    .slice(0, 50);
  const missCsv = ['bridge_tag,concern_count,missing_layers,signal_count,question_count,behavior_cov_pct,archetype_cov_pct,intervention_cov_pct,recommendation_present'];
  for (const r of missing) missCsv.push([r.bridge_tag, r.concern_count, r.missing_layers, r.signal_count, r.question_count, r.behavior_cov, r.archetype_cov, r.intervention_cov, r.recommendation_present].join(','));
  fs.writeFileSync(path.join(OUT, 'top_50_missing_constructs.csv'), missCsv.join('\n'));

  // ---- Top 50 Overlapping Constructs (construct_similarity_map) ----
  const sim = (await pool.query(`SELECT concern_a, concern_b, similarity_score, recommended_group FROM construct_similarity_map ORDER BY similarity_score DESC, concern_a, concern_b`)).rows as any[];
  const labelById = new Map<string, string>(allConcerns.map((c) => [c.concern_id, c.display_label]));
  const tagById = new Map<string, string>(allConcerns.map((c) => [c.concern_id, c.tag]));
  const overlap = sim.slice(0, 50);
  const ovCsv = ['concern_a,label_a,tag_a,concern_b,label_b,tag_b,similarity_score,recommended_group'];
  for (const r of overlap) ovCsv.push([r.concern_a, esc(labelById.get(r.concern_a)), tagById.get(r.concern_a) || '', r.concern_b, esc(labelById.get(r.concern_b)), tagById.get(r.concern_b) || '', r.similarity_score, esc(r.recommended_group)].join(','));
  fs.writeFileSync(path.join(OUT, 'top_50_overlapping_constructs.csv'), ovCsv.join('\n'));

  // ---- Top 50 Candidate Consolidations (similarity recommended_group clusters) ----
  const groups = new Map<string, { members: Set<string>; sims: number[] }>();
  for (const r of sim) {
    if (!r.recommended_group) continue;
    if (!groups.has(r.recommended_group)) groups.set(r.recommended_group, { members: new Set(), sims: [] });
    const g = groups.get(r.recommended_group)!;
    g.members.add(r.concern_a); g.members.add(r.concern_b); g.sims.push(+r.similarity_score);
  }
  const consol = [...groups.entries()]
    .map(([grp, g]) => ({ group: grp, member_count: g.members.size, avg_similarity: +(g.sims.reduce((a, b) => a + b, 0) / g.sims.length).toFixed(3), members: [...g.members] }))
    .filter((g) => g.member_count >= 2)
    .sort((a, b) => (b.member_count * b.avg_similarity) - (a.member_count * a.avg_similarity))
    .slice(0, 50);
  const coCsv = ['recommended_group,member_count,avg_similarity,sample_members'];
  for (const g of consol) coCsv.push([esc(g.group), g.member_count, g.avg_similarity, esc(g.members.slice(0, 6).join(' | '))].join(','));
  fs.writeFileSync(path.join(OUT, 'top_50_candidate_consolidations.csv'), coCsv.join('\n'));

  // ---- summary json ----
  const totalTaggedAtomic = [...sigByTag.values()].reduce((a, b) => a + b, 0);
  const atomicTagsOverlappingConcernTags = [...sigByTag.keys()].filter((t) => tags.has(t)).length;
  const atomicUnderConcernTags = tagRows.reduce((s, r) => s + r.signal_count, 0);
  const summary = {
    generated_at: new Date().toISOString(),
    investigation_only: true,
    ontology_modified: false,
    totals: {
      distinct_bridge_tags: tagRows.length, concerns: totalConcerns,
      tags_with_signals: tagsWith((r) => r.signal_count > 0), tags_with_questions: tagsWith((r) => r.question_count > 0),
      tags_with_behavior: tagsWith((r) => r.behavior_cov > 0), tags_with_archetype: tagsWith((r) => r.archetype_cov > 0),
      tags_with_intervention: tagsWith((r) => r.intervention_cov > 0), tags_with_recommendation: tagsWith((r) => r.recommendation_present === 1),
      construct_namespace_size: recConstructs.size,
      total_tagged_atomic_signals: totalTaggedAtomic, distinct_atomic_bridge_tags: sigByTag.size,
      atomic_tags_overlapping_concern_tags: atomicTagsOverlappingConcernTags, atomic_signals_under_concern_tags: atomicUnderConcernTags,
    },
    layer_scores_0_100: layerScores,
    ontology_health_score: healthScore, ontology_health_rag: healthRag,
    construct_status_counts: {
      GREEN: constructReport.filter((c) => c.status === 'GREEN').length,
      YELLOW: constructReport.filter((c) => c.status === 'YELLOW').length,
      RED: constructReport.filter((c) => c.status === 'RED').length,
    },
    marketed_constructs: constructReport,
  };
  fs.writeFileSync(path.join(OUT, 'ontology_audit_summary.json'), JSON.stringify(summary, null, 2));

  console.log('health score:', healthScore, healthRag);
  console.log('layer scores:', JSON.stringify(layerScores));
  console.log('tags:', tagRows.length, '| with signals:', summary.totals.tags_with_signals, '| with questions:', summary.totals.tags_with_questions, '| with archetype:', summary.totals.tags_with_archetype);
  console.log('construct RAG:', JSON.stringify(summary.construct_status_counts));
  for (const c of constructReport) console.log(`  ${c.construct.padEnd(20)} ${c.status.padEnd(7)} tag=${c.dedicated_tag_concerns} sem=${c.semantic_concerns} sig=${c.signal_count_for_tag} q=${c.question_count_for_tag} beh=${c.behavior_cov_pct}% arch=${c.archetype_cov_pct}% rec=${c.recommendation_construct || '-'}`);
  console.log('wrote', OUT);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
