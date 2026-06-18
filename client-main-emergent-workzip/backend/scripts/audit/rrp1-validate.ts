// RRP-1 VALIDATION — re-run the Concern Resolution Audit through the REAL
// repaired engine and compare against the saved baseline (same 14,934 intents).
// Run: npx tsx scripts/audit/rrp1-validate.ts
//
// The "before" numbers come from the prior audit's saved per-intent results
// (audit/concern-resolution/_raw_results.json — identical intents), so the
// before/after comparison is apples-to-apples on the very same intent set.
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResolverCorpus, resolveConcern, type ConcernRowInput } from '../../services/concern-resolver-engine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const PRIOR = path.join(ROOT, 'audit/concern-resolution');
const OUT = path.join(ROOT, 'audit/rrp1');

interface RawIntent { ti: number; intent: string; nTok: number; klass: string; baseTie: number; }
interface Meta { i: number; id: string; label: string; tag: string; cluster: string; }

function pct(n: number, d: number) { return d ? +(100 * n / d).toFixed(1) : 0; }

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: databaseUrl });
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Build the corpus from the live DB (full haystack — same as the resolver).
  const rs = await pool.query(
    `SELECT concern_id, display_label, concern_cluster, concern_category,
            common_indian_context, domain, relational_bridge_tag,
            primary_persona, age_min, age_max
       FROM capadex_concerns_master`,
  );
  const corpus = buildResolverCorpus(rs.rows as ConcernRowInput[]);
  const byId = new Map<string, { tag: string; cluster: string }>();
  for (const r of rs.rows as any[]) {
    byId.set(r.concern_id, { tag: r.relational_bridge_tag || '', cluster: (r.concern_cluster || '') });
  }

  // 2. Load the saved intents + the concern meta (ti → target).
  const raw: RawIntent[] = JSON.parse(fs.readFileSync(path.join(PRIOR, '_raw_results.json'), 'utf8'));
  const meta: Meta[] = JSON.parse(fs.readFileSync(path.join(PRIOR, '_concerns_meta.json'), 'utf8'));

  // 3. Classify each intent through the repaired engine (persona-null baseline).
  const after = { exact: 0, near: 0, drift: 0, failure: 0, tie2: 0, tie10: 0, arbitrary: 0 };
  const before = { exact: 0, near: 0, drift: 0, failure: 0, tie2: 0, tie10: 0, arbitrary: 0 };
  const shortB = { total: 0, exact: 0, fail: 0 };
  const shortA = { total: 0, exact: 0, fail: 0 };
  const fixedDrift: string[] = ['intent,target_id,target_tag,before_class,after_class,resolved_id,confidence'];
  const fixedFail: string[] = ['intent,target_id,target_label,before_class,resolved_id,confidence,short_intent'];
  const stillBad: string[] = ['intent,target_id,target_tag,after_class,resolved_id,tie_count,confidence'];
  const confBuckets = [0, 0, 0, 0, 0]; // 0-19,20-39,40-59,60-79,80-100
  let confSum = 0, confN = 0;

  for (const r of raw) {
    const tgt = meta[r.ti];
    if (!tgt) continue;
    const tgtMeta = byId.get(tgt.id);
    // before (from saved klass)
    (before as any)[r.klass]++;
    if (r.baseTie >= 2) before.tie2++;
    if (r.baseTie >= 10) before.tie10++;
    const isShort = r.nTok <= 3;
    if (isShort) { shortB.total++; if (r.klass === 'exact') shortB.exact++; if (r.klass === 'failure') shortB.fail++; }

    // after (real engine)
    const res = resolveConcern(corpus, r.intent, null, null);
    let klass: 'exact' | 'near' | 'drift' | 'failure';
    if (!res.concern_id) klass = 'failure';
    else if (res.concern_id === tgt.id) klass = 'exact';
    else {
      const rm = byId.get(res.concern_id);
      const sameTag = rm && tgtMeta && rm.tag && rm.tag === tgtMeta.tag;
      const sameCluster = rm && tgtMeta && rm.cluster && rm.cluster === tgtMeta.cluster;
      klass = (sameTag || sameCluster) ? 'near' : 'drift';
    }
    (after as any)[klass]++;
    if (res.tie_count >= 2) after.tie2++;
    if (res.tie_count >= 10) after.tie10++;
    if (res.concern_id && res.tie_break_reason === 'concern_id_fallback') after.arbitrary++;
    if (isShort) { shortA.total++; if (klass === 'exact') shortA.exact++; if (klass === 'failure') shortA.fail++; }

    if (res.concern_id) { confSum += res.confidence; confN++; confBuckets[Math.min(4, Math.floor(res.confidence / 20))]++; }

    const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
    if (r.klass === 'drift' && klass !== 'drift') fixedDrift.push([esc(r.intent), tgt.id, tgtMeta?.tag || '', r.klass, klass, res.concern_id || '', String(res.confidence)].join(','));
    if (r.klass === 'failure' && klass !== 'failure') fixedFail.push([esc(r.intent), tgt.id, esc(tgt.label), r.klass, res.concern_id || '', String(res.confidence), String(res.short_intent)].join(','));
    if ((klass === 'drift' || klass === 'failure')) stillBad.push([esc(r.intent), tgt.id, tgtMeta?.tag || '', klass, res.concern_id || '', String(res.tie_count), String(res.confidence)].join(','));
  }

  const N = raw.length;
  const trust = (a: typeof after) => {
    // RAG: GREEN if exact>90 & drift<5 & fail<2 & tie<10; else YELLOW unless badly off → RED
    const ex = pct(a.exact, N), dr = pct(a.drift, N), fa = pct(a.failure, N), ti = pct(a.tie2, N);
    if (ex > 90 && dr < 5 && fa < 2 && ti < 10) return 'GREEN';
    if (ex < 70 || dr > 15 || fa > 10) return 'RED';
    return 'YELLOW';
  };

  const summary = {
    generated_at: new Date().toISOString(),
    total_intents: N,
    targets: { exact: '>90%', drift: '<5%', failure: '<2%', tie_rate: '<10%' },
    before: {
      exact: pct(before.exact, N), near: pct(before.near, N), drift: pct(before.drift, N),
      failure: pct(before.failure, N), tie_ge2: pct(before.tie2, N), tie_ge10: pct(before.tie10, N),
      trust: trust(before),
      counts: before,
    },
    after: {
      exact: pct(after.exact, N), near: pct(after.near, N), drift: pct(after.drift, N),
      failure: pct(after.failure, N), tie_ge2: pct(after.tie2, N), tie_ge10: pct(after.tie10, N),
      trust: trust(after),
      counts: after,
    },
    deltas: {
      exact: +(pct(after.exact, N) - pct(before.exact, N)).toFixed(1),
      drift: +(pct(after.drift, N) - pct(before.drift, N)).toFixed(1),
      failure: +(pct(after.failure, N) - pct(before.failure, N)).toFixed(1),
      tie_ge2: +(pct(after.tie2, N) - pct(before.tie2, N)).toFixed(1),
    },
    short_intent: {
      before: { total: shortB.total, exact_pct: pct(shortB.exact, shortB.total), fail_pct: pct(shortB.fail, shortB.total) },
      after: { total: shortA.total, exact_pct: pct(shortA.exact, shortA.total), fail_pct: pct(shortA.fail, shortA.total) },
    },
    confidence: {
      mean: confN ? +(confSum / confN).toFixed(1) : 0,
      resolved: confN,
      buckets: { '0-19': confBuckets[0], '20-39': confBuckets[1], '40-59': confBuckets[2], '60-79': confBuckets[3], '80-100': confBuckets[4] },
    },
    targets_met: {
      exact_gt_90: pct(after.exact, N) > 90,
      drift_lt_5: pct(after.drift, N) < 5,
      failure_lt_2: pct(after.failure, N) < 2,
      tie_lt_10: pct(after.tie2, N) < 10,
    },
  };

  fs.writeFileSync(path.join(OUT, 'validation_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'drift_reduction_fixed.csv'), fixedDrift.join('\n'));
  fs.writeFileSync(path.join(OUT, 'short_intent_recovered.csv'), fixedFail.join('\n'));
  fs.writeFileSync(path.join(OUT, 'still_unresolved.csv'), stillBad.join('\n'));

  console.log('BEFORE:', summary.before.exact + '% exact,', summary.before.drift + '% drift,', summary.before.failure + '% fail,', summary.before.tie_ge2 + '% tie →', summary.before.trust);
  console.log('AFTER :', summary.after.exact + '% exact,', summary.after.drift + '% drift,', summary.after.failure + '% fail,', summary.after.tie_ge2 + '% tie →', summary.after.trust);
  console.log('short-intent fail:', summary.short_intent.before.fail_pct + '% →', summary.short_intent.after.fail_pct + '%');
  console.log('targets met:', JSON.stringify(summary.targets_met));
  console.log('wrote', OUT);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
