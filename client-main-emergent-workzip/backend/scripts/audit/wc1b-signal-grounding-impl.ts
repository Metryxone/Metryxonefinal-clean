// WC-1B — Signal Grounding Implementation (ADDITIVE, non-destructive).
// Implements the WC-1A approved GREEN mappings (182 tags) by recording REUSE relationships
// between existing bridge tags and existing atomic signals (via signal families).
// Run: cd backend && npx tsx scripts/audit/wc1b-signal-grounding-impl.ts [--dry-run]
//
// Guarantees: no new signals, no new concerns, no new bridge tags, no ontology restructuring,
// no signal duplication, no signal fabrication. Reads the APPROVED WC-1A CSV artifacts directly
// (no recompute), so the implemented mapping is exactly what was reviewed.
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WC1A = path.resolve(__dirname, '../../../audit/wc1a');
const OUT = path.resolve(__dirname, '../../../audit/wc1b');
const DRY = process.argv.includes('--dry-run');
const TAU_HIGH = 0.2139; // GREEN floor from WC-1A calibration; ground only families at/above this

// WC-1 layer scores (other 7 layers held fixed; only the signal layer moves with grounding)
const LAYERS = { question: 99.1, capability: 36.4, problem: 36.4, behavior: 100, archetype: 86.4, intervention: 86.4, recommendation: 34.5 };
const health = (signal: number) => +(((signal + LAYERS.question + LAYERS.capability + LAYERS.problem + LAYERS.behavior + LAYERS.archetype + LAYERS.intervention + LAYERS.recommendation) / 8)).toFixed(1);
const esc = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

function parseCsv(file: string): Record<string, string>[] {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const lines = txt.split('\n').filter((l) => l.length);
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
    }
    out.push(cur); return out;
  };
  const hdr = parseLine(lines[0]);
  return lines.slice(1).map((l) => { const v = parseLine(l); const o: Record<string, string> = {}; hdr.forEach((h, i) => (o[h] = v[i])); return o; });
}

async function coverage(pool: Pool, opts: { nativeOnly?: boolean } = {}) {
  // tag universe = distinct bridge tags appearing in concerns master (WC-1/WC-1A denominator)
  const tags = (await pool.query(`SELECT relational_bridge_tag tag, count(*) c FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[];
  const totalTags = tags.length;
  const totalConcerns = tags.reduce((s, r) => s + +r.c, 0);
  const concernByTag = new Map<string, number>(tags.map((r) => [r.tag, +r.c]));

  const native = new Set<string>((await pool.query(`SELECT DISTINCT relational_bridge_tag t FROM capadex_atomic_signals WHERE relational_bridge_tag IS NOT NULL`)).rows.map((r: any) => r.t));
  let grounded = new Set<string>();
  // grounded if it has native atomic signals OR (unless nativeOnly) a grounding-table row.
  // nativeOnly=true gives a rerun-stable baseline independent of any prior wc1a_green rows.
  let viaTable = new Set<string>();
  if (!opts.nativeOnly) {
    const tblExists = (await pool.query(`SELECT to_regclass('public.capadex_bridge_tag_family_grounding') r`)).rows[0].r;
    if (tblExists) viaTable = new Set<string>((await pool.query(`SELECT DISTINCT bridge_tag t FROM capadex_bridge_tag_family_grounding`)).rows.map((r: any) => r.t));
  }
  for (const t of concernByTag.keys()) if (native.has(t) || viaTable.has(t)) grounded.add(t);

  const groundedConcerns = [...grounded].reduce((s, t) => s + (concernByTag.get(t) || 0), 0);
  const sigCovTags = +(100 * grounded.size / totalTags).toFixed(1);
  const concernCov = +(100 * groundedConcerns / totalConcerns).toFixed(1);
  return { totalTags, totalConcerns, groundedTags: grounded.size, groundedConcerns, sigCovTags, concernCov, health: health(sigCovTags), concernByTag };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(OUT, { recursive: true });

  // immutability fingerprints
  const fp = async () => ({
    atomic: +(await pool.query(`SELECT count(*) c FROM capadex_atomic_signals`)).rows[0].c,
    concerns: +(await pool.query(`SELECT count(*) c FROM capadex_concerns_master`)).rows[0].c,
    distinctTagOnConcerns: +(await pool.query(`SELECT count(DISTINCT relational_bridge_tag) c FROM capadex_concerns_master`)).rows[0].c,
  });
  const fpBefore = await fp();
  // rerun-stable baseline: native-only (independent of any prior wc1a_green rows)
  const before = await coverage(pool, { nativeOnly: true });

  // canonical bridge-tag universe (integrity guard: never insert a tag that is not a real concern tag)
  const canonicalTags = new Set<string>((await pool.query(`SELECT DISTINCT relational_bridge_tag t FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`)).rows.map((r: any) => r.t));

  // ---- approved WC-1A mappings ----
  const matrix = parseCsv(path.join(WC1A, 'signal_grounding_matrix.csv'));
  const greenTags = new Set(matrix.filter((r) => r.classification === 'GREEN').map((r) => r.bridge_tag));
  const reuse = parseCsv(path.join(WC1A, 'candidate_signal_reuse_map.csv'));
  // (tag, family) pairs that are GREEN and family sim >= TAU_HIGH
  const rawPairs = reuse.filter((r) => r.classification === 'GREEN' && greenTags.has(r.bridge_tag) && parseFloat(r.similarity) >= TAU_HIGH)
    .map((r) => ({ tag: r.bridge_tag, family: r.candidate_family, domain: r.domain, similarity: parseFloat(r.similarity) }));
  // integrity guard: drop any pair whose bridge_tag is NOT in the canonical concern-tag universe
  const rejectedTags = [...new Set(rawPairs.filter((p) => !canonicalTags.has(p.tag)).map((p) => p.tag))];
  const pairs = rawPairs.filter((p) => canonicalTags.has(p.tag));
  if (rejectedTags.length) console.warn(`REJECTED ${rejectedTags.length} non-canonical bridge tags (not inserted): ${rejectedTags.join(', ')}`);

  // every GREEN tag must keep at least its best (rank1) family even if a later one dips below — but rank1 is GREEN's best >= TAU_HIGH by definition
  console.log(`approved GREEN tags=${greenTags.size}, (tag,family) pairs>=TAU_HIGH=${pairs.length}, rejected_noncanonical=${rejectedTags.length}`);

  // ---- atomic signal membership per family (one query) ----
  const famRows = (await pool.query(`SELECT family_name, domain_name, atomic_signal_id, COALESCE(signal_label, atomic_signal_name) nm, severity_weight FROM capadex_atomic_signals`)).rows as any[];
  const byFamily = new Map<string, { id: string; nm: string; sev: number; domain: string }[]>();
  for (const r of famRows) {
    if (!byFamily.has(r.family_name)) byFamily.set(r.family_name, []);
    byFamily.get(r.family_name)!.push({ id: r.atomic_signal_id, nm: r.nm, sev: +r.severity_weight || 0, domain: r.domain_name });
  }

  // ---- schema (lazy ensure, mirrors migration) ----
  if (!DRY) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capadex_bridge_tag_family_grounding (
        id BIGSERIAL PRIMARY KEY, bridge_tag TEXT NOT NULL, signal_family TEXT NOT NULL, domain_name TEXT,
        similarity NUMERIC(6,4), atomic_signal_count INTEGER NOT NULL DEFAULT 0, evidence_strength TEXT,
        provenance TEXT NOT NULL DEFAULT 'wc1a_green', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (bridge_tag, signal_family));`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capadex_bridge_tag_signal_grounding (
        id BIGSERIAL PRIMARY KEY, bridge_tag TEXT NOT NULL, signal_family TEXT NOT NULL, domain_name TEXT,
        atomic_signal_id TEXT NOT NULL, atomic_signal_name TEXT, similarity NUMERIC(6,4), evidence_strength TEXT,
        provenance TEXT NOT NULL DEFAULT 'wc1a_green', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (bridge_tag, atomic_signal_id));`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_btsg_bridge_tag ON capadex_bridge_tag_signal_grounding (bridge_tag);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_btsg_atomic ON capadex_bridge_tag_signal_grounding (atomic_signal_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_btsg_family ON capadex_bridge_tag_signal_grounding (signal_family);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_btfg_bridge_tag ON capadex_bridge_tag_family_grounding (bridge_tag);`);
    // idempotent: clear any prior wc1a_green rows so re-runs reconcile (no duplication / no drift)
    await pool.query(`DELETE FROM capadex_bridge_tag_signal_grounding WHERE provenance='wc1a_green'`);
    await pool.query(`DELETE FROM capadex_bridge_tag_family_grounding WHERE provenance='wc1a_green'`);
  }

  // ---- insert grounding rows ----
  const evidence = (s: number) => (s >= 0.30 ? 'strong' : s >= TAU_HIGH ? 'good' : 'moderate');
  const linkageAudit: string[] = ['bridge_tag,signal_family,domain_name,similarity,atomic_signal_count,evidence_strength,sample_signals'];
  let famInserted = 0, atomicRows: any[] = [];
  for (const p of pairs) {
    const members = byFamily.get(p.family) || [];
    if (!members.length) continue;
    famInserted++;
    if (!DRY) await pool.query(
      `INSERT INTO capadex_bridge_tag_family_grounding (bridge_tag, signal_family, domain_name, similarity, atomic_signal_count, evidence_strength, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,'wc1a_green') ON CONFLICT (bridge_tag, signal_family) DO NOTHING`,
      [p.tag, p.family, p.domain, p.similarity, members.length, evidence(p.similarity)]);
    for (const m of members) atomicRows.push([p.tag, p.family, m.domain, m.id, m.nm, p.similarity, evidence(p.similarity)]);
    const sample = [...new Set(members.sort((a, b) => b.sev - a.sev).map((m) => m.nm))].slice(0, 5).join(' | ');
    linkageAudit.push([p.tag, esc(p.family), esc(p.domain), p.similarity.toFixed(4), members.length, evidence(p.similarity), esc(sample)].join(','));
  }

  // chunked atomic insert (ON CONFLICT DO NOTHING -> no duplication; a signal may ground several tags)
  let atomicInserted = 0;
  if (!DRY) {
    const CH = 800;
    for (let i = 0; i < atomicRows.length; i += CH) {
      const chunk = atomicRows.slice(i, i + CH);
      const vals: any[] = []; const ph: string[] = [];
      chunk.forEach((r, j) => { const b = j * 7; ph.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},'wc1a_green')`); vals.push(...r); });
      const res = await pool.query(
        `INSERT INTO capadex_bridge_tag_signal_grounding (bridge_tag, signal_family, domain_name, atomic_signal_id, atomic_signal_name, similarity, evidence_strength, provenance)
         VALUES ${ph.join(',')} ON CONFLICT (bridge_tag, atomic_signal_id) DO NOTHING`, vals);
      atomicInserted += res.rowCount || 0;
    }
  } else {
    atomicInserted = atomicRows.length;
  }

  // ---- verification ----
  const fpAfter = await fp();
  const after = await coverage(pool);
  let verify: any = { dry_run: DRY };
  if (!DRY) {
    const P = `provenance='wc1a_green'`;
    const fabricated = +(await pool.query(`SELECT count(*) c FROM capadex_bridge_tag_signal_grounding g LEFT JOIN capadex_atomic_signals a ON a.atomic_signal_id=g.atomic_signal_id WHERE g.${P} AND a.atomic_signal_id IS NULL`)).rows[0].c;
    const totalRows = +(await pool.query(`SELECT count(*) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
    const distinctPairs = +(await pool.query(`SELECT count(*) c FROM (SELECT DISTINCT bridge_tag, atomic_signal_id FROM capadex_bridge_tag_signal_grounding WHERE ${P}) t`)).rows[0].c;
    const distinctSignalsReused = +(await pool.query(`SELECT count(DISTINCT atomic_signal_id) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
    const tagsGrounded = +(await pool.query(`SELECT count(DISTINCT bridge_tag) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
    // tag integrity: every grounded bridge_tag must exist in the canonical concern-tag universe
    const nonCanonical = +(await pool.query(`SELECT count(DISTINCT g.bridge_tag) c FROM capadex_bridge_tag_signal_grounding g WHERE g.${P} AND NOT EXISTS (SELECT 1 FROM capadex_concerns_master m WHERE m.relational_bridge_tag = g.bridge_tag)`)).rows[0].c;
    verify = {
      dry_run: false,
      no_signal_fabrication: fabricated === 0, fabricated_rows: fabricated,
      no_signal_duplication: totalRows === distinctPairs, total_atomic_rows: totalRows, distinct_tag_signal_pairs: distinctPairs,
      no_new_bridge_tags: nonCanonical === 0 && rejectedTags.length === 0, non_canonical_tags_inserted: nonCanonical, non_canonical_tags_rejected_pre_insert: rejectedTags.length,
      no_new_signals: fpAfter.atomic === fpBefore.atomic, atomic_signals_before: fpBefore.atomic, atomic_signals_after: fpAfter.atomic,
      no_concern_modification: fpAfter.concerns === fpBefore.concerns, concerns_before: fpBefore.concerns, concerns_after: fpAfter.concerns,
      no_bridge_tag_modification: fpAfter.distinctTagOnConcerns === fpBefore.distinctTagOnConcerns, distinct_bridge_tags_before: fpBefore.distinctTagOnConcerns, distinct_bridge_tags_after: fpAfter.distinctTagOnConcerns,
      distinct_signals_reused: distinctSignalsReused, tags_grounded_in_table: tagsGrounded,
    };
  }

  // ---- forecasts (directional; runtime wiring is OUT OF SCOPE for WC-1B) ----
  const greenConcerns = matrix.filter((r) => r.classification === 'GREEN').reduce((s, r) => s + (+r.concern_count || 0), 0);
  const greenQuestions = matrix.filter((r) => r.classification === 'GREEN').reduce((s, r) => s + (+r.question_count || 0), 0);
  const totalQuestions = matrix.reduce((s, r) => s + (+r.question_count || 0), 0);

  const summary = {
    generated_at: new Date().toISOString(), dry_run: DRY, runtime_activation_wired: false,
    note: 'Additive reuse-linkage only. Runtime signal-activation wiring is a deliberate follow-up (forecast figures below are directional, not measured runtime deltas).',
    tags_grounded: pairs.length ? new Set(pairs.map((p) => p.tag)).size : 0,
    family_links: famInserted, atomic_links: atomicInserted, signals_reused_distinct: verify.distinct_signals_reused ?? new Set(atomicRows.map((r) => r[3])).size,
    coverage: {
      signal_coverage_before_pct: before.sigCovTags, signal_coverage_after_pct: after.sigCovTags, signal_coverage_delta_pct: +(after.sigCovTags - before.sigCovTags).toFixed(1),
      concern_coverage_before_pct: before.concernCov, concern_coverage_after_pct: after.concernCov, concern_coverage_delta_pct: +(after.concernCov - before.concernCov).toFixed(1),
      ontology_health_before: before.health, ontology_health_after: after.health, ontology_health_delta: +(after.health - before.health).toFixed(1),
      tags_total: after.totalTags, tags_grounded_before: before.groundedTags, tags_grounded_after: after.groundedTags,
    },
    success_criteria: {
      signal_coverage_gt_60: after.sigCovTags > 60, concern_coverage_gt_85: after.concernCov > 85, ontology_health_gt_67: after.health > 67,
      all_pass: after.sigCovTags > 60 && after.concernCov > 85 && after.health > 67,
    },
    resolver_impact_forecast: { concerns_newly_grounded: greenConcerns, basis: 'concerns under newly-grounded GREEN tags gain reusable atomic-signal evidence', note: 'directional; not a measured resolver-accuracy delta; requires runtime wiring (follow-up) to realize' },
    question_quality_impact_forecast: { questions_under_grounded_green: greenQuestions, questions_total: totalQuestions, pct_addressable: +(100 * greenQuestions / totalQuestions).toFixed(1), note: 'directional; clarity questions under grounded tags become signal-targetable once runtime wiring lands' },
    verification: verify,
  };
  fs.writeFileSync(path.join(OUT, 'signal_grounding_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'signal_linkage_audit.csv'), linkageAudit.join('\n'));

  // coverage delta report (md + json)
  const cd = {
    signal_coverage: { before: before.sigCovTags, after: after.sigCovTags, target: 60, pass: after.sigCovTags > 60 },
    concern_coverage: { before: before.concernCov, after: after.concernCov, target: 85, pass: after.concernCov > 85 },
    ontology_health: { before: before.health, after: after.health, target: 67, pass: after.health > 67 },
  };
  fs.writeFileSync(path.join(OUT, 'coverage_delta_report.json'), JSON.stringify({ ...cd, verification: verify }, null, 2));

  const md = `# WC-1B — Coverage Delta Report

${DRY ? '**DRY RUN — no rows written.**\n' : ''}
| Metric | Before | After | Δ | Target | Result |
|---|---:|---:|---:|---:|:--:|
| Signal coverage (tags) | ${before.sigCovTags}% | **${after.sigCovTags}%** | +${(after.sigCovTags - before.sigCovTags).toFixed(1)} | >60% | ${cd.signal_coverage.pass ? 'PASS' : 'FAIL'} |
| Concern coverage | ${before.concernCov}% | **${after.concernCov}%** | +${(after.concernCov - before.concernCov).toFixed(1)} | >85% | ${cd.concern_coverage.pass ? 'PASS' : 'FAIL'} |
| Ontology Health | ${before.health} | **${after.health}** | +${(after.health - before.health).toFixed(1)} | >67 | ${cd.ontology_health.pass ? 'PASS' : 'FAIL'} |

- Tags grounded: ${before.groundedTags} → **${after.groundedTags}** of ${after.totalTags}
- Family links created: **${famInserted}** · Atomic reuse links: **${atomicInserted}** · Distinct signals reused: **${summary.signals_reused_distinct}**

## Verification
${DRY ? '_dry run_' : Object.entries(verify).filter(([k]) => k.startsWith('no_')).map(([k, v]) => `- ${k}: ${v ? 'OK' : 'FAIL'}`).join('\n')}
`;
  fs.writeFileSync(path.join(OUT, 'coverage_delta_report.md'), md);

  console.log(JSON.stringify(summary.coverage, null, 1));
  console.log('success:', JSON.stringify(summary.success_criteria));
  console.log('verify:', JSON.stringify(verify));
  console.log('wrote', OUT, DRY ? '(DRY RUN)' : '');
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
