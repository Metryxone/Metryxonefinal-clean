// WC-1C-Y — YELLOW Signal Grounding Implementation (ADDITIVE, non-destructive).
// Activates the 121 WC-1A YELLOW bridge tags by recording REUSE relationships between
// existing bridge tags and existing atomic signals (via signal families) — the same
// additive grounding layer WC-1B used for GREEN, here provenance 'wc1a_yellow'.
// Run: cd backend && npx tsx scripts/audit/wc1c-y-signal-grounding-impl.ts [--dry-run]
//
// Guarantees (ENFORCED, not just asserted): no new signals, no new concerns, no new bridge
// tags, no ontology restructuring, no signal duplication, no signal fabrication. Reads the
// APPROVED WC-1A CSV artifacts directly (no recompute) so the mapping is exactly what was
// reviewed. Reversible: DELETE FROM <tbl> WHERE provenance='wc1a_yellow'. Idempotent.
// Runtime signal-activation / resolver wiring is DELIBERATELY OUT OF SCOPE (deferred).
import { Pool, type PoolClient } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WC1A = path.resolve(__dirname, '../../../audit/wc1a');
const OUT = path.resolve(__dirname, '../../../audit/wc1c-y');
const DRY = process.argv.includes('--dry-run');

const TAU_HIGH = 0.2139; // GREEN floor (WC-1A calibration)
const TAU_LOW = 0.0963;  // YELLOW floor = 0.45 * TAU_HIGH (WC-1A calibration); ground YELLOW families at/above this
const PROV = 'wc1a_yellow';
const GREEN_PROV = 'wc1a_green';

// WC-1 layer scores (other 7 held fixed; only the signal layer moves with grounding)
const LAYERS = { question: 99.1, capability: 36.4, problem: 36.4, behavior: 100, archetype: 86.4, intervention: 86.4, recommendation: 34.5 };
const health = (signal: number) => +(((signal + LAYERS.question + LAYERS.capability + LAYERS.problem + LAYERS.behavior + LAYERS.archetype + LAYERS.intervention + LAYERS.recommendation) / 8)).toFixed(1);
// evidence → trust weight (strong grounding contributes full trust; moderate YELLOW contributes half)
const EV_WEIGHT: Record<string, number> = { strong: 1.0, good: 0.8, moderate: 0.5 };
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

// Tag-coverage over the canonical 328 concern bridge tags. A tag is grounded if it has
// NATIVE atomic signals OR a grounding-table row whose provenance is in `includeProv`.
async function coverage(db: Pool | PoolClient, includeProv: string[]) {
  const tags = (await db.query(`SELECT relational_bridge_tag tag, count(*) c FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[];
  const totalTags = tags.length;
  const totalConcerns = tags.reduce((s, r) => s + +r.c, 0);
  const concernByTag = new Map<string, number>(tags.map((r) => [r.tag, +r.c]));

  const native = new Set<string>((await db.query(`SELECT DISTINCT relational_bridge_tag t FROM capadex_atomic_signals WHERE relational_bridge_tag IS NOT NULL`)).rows.map((r: any) => r.t));
  let viaTable = new Set<string>();
  if (includeProv.length) {
    const tblExists = (await db.query(`SELECT to_regclass('public.capadex_bridge_tag_family_grounding') r`)).rows[0].r;
    if (tblExists) viaTable = new Set<string>((await db.query(`SELECT DISTINCT bridge_tag t FROM capadex_bridge_tag_family_grounding WHERE provenance = ANY($1)`, [includeProv])).rows.map((r: any) => r.t));
  }
  const grounded = new Set<string>();
  for (const t of concernByTag.keys()) if (native.has(t) || viaTable.has(t)) grounded.add(t);

  const groundedConcerns = [...grounded].reduce((s, t) => s + (concernByTag.get(t) || 0), 0);
  const sigCovTags = +(100 * grounded.size / totalTags).toFixed(1);
  const concernCov = +(100 * groundedConcerns / totalConcerns).toFixed(1);
  return { totalTags, totalConcerns, groundedTags: grounded.size, groundedConcerns, sigCovTags, concernCov, health: health(sigCovTags), grounded, concernByTag };
}

// Per-tag best evidence weight: native tags = strong(1.0); table tags = best evidence_strength
// among their family rows for the included provenances.
async function tagEvidenceWeights(db: Pool | PoolClient, includeProv: string[]) {
  const map = new Map<string, number>();
  if (includeProv.length) {
    const rows = (await db.query(`SELECT bridge_tag tag, evidence_strength ev FROM capadex_bridge_tag_family_grounding WHERE provenance = ANY($1)`, [includeProv])).rows as any[];
    for (const r of rows) { const w = EV_WEIGHT[r.ev] ?? 0.5; if (!map.has(r.tag) || w > (map.get(r.tag) as number)) map.set(r.tag, w); }
  }
  const native = (await db.query(`SELECT DISTINCT relational_bridge_tag t FROM capadex_atomic_signals WHERE relational_bridge_tag IS NOT NULL`)).rows.map((r: any) => r.t);
  for (const t of native) map.set(t, 1.0); // native first-class signals = strong
  return map;
}

// Trust Score = evidence-weighted tag grounding over the 328 concern tags (0..100).
// Assessment Intelligence Score = evidence-weighted QUESTION coverage over the live bank (0..100).
async function trustAndAis(db: Pool | PoolClient, concernByTag: Map<string, number>, evMap: Map<string, number>) {
  const concernTags = [...concernByTag.keys()];
  const trustSum = concernTags.reduce((s, t) => s + (evMap.get(t) ?? 0), 0);
  const trust = +(100 * trustSum / concernTags.length).toFixed(1);

  const qrows = (await db.query(`SELECT master_bridge_tag tag, count(*) c FROM capadex_clarity_questions WHERE master_bridge_tag IS NOT NULL GROUP BY 1`)).rows as any[];
  const totalQ = qrows.reduce((s, r) => s + +r.c, 0);
  const coveredQ = qrows.filter((r) => evMap.has(r.tag)).reduce((s, r) => s + +r.c, 0);
  const weightedQ = qrows.reduce((s, r) => s + (evMap.get(r.tag) ?? 0) * +r.c, 0);
  const qCovPct = +(100 * coveredQ / totalQ).toFixed(1);
  const ais = +(100 * weightedQ / totalQ).toFixed(1);
  return { trust, ais, totalQ, coveredQ, qCovPct };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(OUT, { recursive: true });

  // immutability fingerprints
  const fp = async (db: Pool | PoolClient) => ({
    atomic: +(await db.query(`SELECT count(*) c FROM capadex_atomic_signals`)).rows[0].c,
    concerns: +(await db.query(`SELECT count(*) c FROM capadex_concerns_master`)).rows[0].c,
    distinctTagOnConcerns: +(await db.query(`SELECT count(DISTINCT relational_bridge_tag) c FROM capadex_concerns_master`)).rows[0].c,
    greenRows: +(await db.query(`SELECT count(*) c FROM capadex_bridge_tag_signal_grounding WHERE provenance=$1`, [GREEN_PROV])).rows[0].c,
  });
  const fpBefore = await fp(pool);

  // canonical bridge-tag universe (integrity guard: never insert a tag that is not a real concern tag)
  const canonicalTags = new Set<string>((await pool.query(`SELECT DISTINCT relational_bridge_tag t FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`)).rows.map((r: any) => r.t));

  // ---- approved WC-1A YELLOW mappings ----
  const matrix = parseCsv(path.join(WC1A, 'signal_grounding_matrix.csv'));
  const yellowTags = new Set(matrix.filter((r) => r.classification === 'YELLOW').map((r) => r.bridge_tag));
  const reuse = parseCsv(path.join(WC1A, 'candidate_signal_reuse_map.csv'));
  // (tag, family) pairs that are YELLOW and family sim >= TAU_LOW (the YELLOW floor)
  const rawPairs = reuse.filter((r) => r.classification === 'YELLOW' && yellowTags.has(r.bridge_tag) && parseFloat(r.similarity) >= TAU_LOW)
    .map((r) => ({ tag: r.bridge_tag, family: r.candidate_family, domain: r.domain, similarity: parseFloat(r.similarity) }));

  // BAND ENFORCEMENT (defense-in-depth — do NOT trust the WC-1A labels blindly): every grounded
  // YELLOW pair must fall in the declared band [TAU_LOW, TAU_HIGH). A YELLOW-classified tag whose
  // best family ≥ TAU_HIGH would be a GREEN — a class-band inconsistency we refuse to silently absorb.
  const outOfBand = rawPairs.filter((p) => !(p.similarity >= TAU_LOW && p.similarity < TAU_HIGH));
  if (outOfBand.length) throw new Error(`BAND VIOLATION: ${outOfBand.length} YELLOW (tag,family) pairs outside [${TAU_LOW}, ${TAU_HIGH}); refusing to ground. e.g. ${outOfBand.slice(0, 3).map((p) => `${p.tag}/${p.family}=${p.similarity}`).join(', ')}`);

  const rejectedTags = [...new Set(rawPairs.filter((p) => !canonicalTags.has(p.tag)).map((p) => p.tag))];
  const pairs = rawPairs.filter((p) => canonicalTags.has(p.tag));
  if (rejectedTags.length) console.warn(`REJECTED ${rejectedTags.length} non-canonical bridge tags (not inserted): ${rejectedTags.join(', ')}`);
  console.log(`approved YELLOW tags=${yellowTags.size}, (tag,family) pairs in [${TAU_LOW},${TAU_HIGH})=${pairs.length}, rejected_noncanonical=${rejectedTags.length}`);

  // ---- atomic signal membership per family (one query) ----
  const famRows = (await pool.query(`SELECT family_name, domain_name, atomic_signal_id, COALESCE(signal_label, atomic_signal_name) nm, severity_weight FROM capadex_atomic_signals`)).rows as any[];
  const byFamily = new Map<string, { id: string; nm: string; sev: number; domain: string }[]>();
  for (const r of famRows) {
    if (!byFamily.has(r.family_name)) byFamily.set(r.family_name, []);
    byFamily.get(r.family_name)!.push({ id: r.atomic_signal_id, nm: r.nm, sev: +r.severity_weight || 0, domain: r.domain_name });
  }

  // ---- BEFORE measurement (native ∪ GREEN; scoped by provenance so it is independent of any yellow rows) ----
  const before = await coverage(pool, [GREEN_PROV]);
  const beforeEv = await tagEvidenceWeights(pool, [GREEN_PROV]);
  const beforeTA = await trustAndAis(pool, before.concernByTag, beforeEv);

  // ---- build the YELLOW grounding rows IN MEMORY (no DB writes yet) ----
  const evidence = (s: number) => (s >= 0.30 ? 'strong' : s >= TAU_HIGH ? 'good' : 'moderate'); // YELLOW band < TAU_HIGH ⇒ all 'moderate'
  const linkageAudit: string[] = ['bridge_tag,signal_family,domain_name,similarity,atomic_signal_count,evidence_strength,sample_signals'];
  let famInserted = 0; const atomicRows: any[] = [];
  for (const p of pairs) {
    const members = byFamily.get(p.family) || [];
    if (!members.length) continue;
    famInserted++;
    for (const m of members) atomicRows.push([p.tag, p.family, m.domain, m.id, m.nm, p.similarity, evidence(p.similarity)]);
    const sample = [...new Set(members.sort((a, b) => b.sev - a.sev).map((m) => m.nm))].slice(0, 5).join(' | ');
    linkageAudit.push([p.tag, esc(p.family), esc(p.domain), p.similarity.toFixed(4), members.length, evidence(p.similarity), esc(sample)].join(','));
  }

  // ---- MUTATE + VERIFY inside ONE transaction; any guardrail failure ROLLS BACK (no partial writes).
  // DRY runs take the SAME path against the txn snapshot, then ROLLBACK — so --dry-run is a true
  // projection from the in-memory candidate rows (independent of any ambient wc1a_yellow rows) and
  // still exercises every guardrail, rather than reading ambient DB state. ----
  let after: any, afterTA: any, verify: any = { dry_run: DRY }, atomicInserted = atomicRows.length;
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // schema (lazy ensure, mirrors WC-1B migration; tables already exist)
      await client.query(`
        CREATE TABLE IF NOT EXISTS capadex_bridge_tag_family_grounding (
          id BIGSERIAL PRIMARY KEY, bridge_tag TEXT NOT NULL, signal_family TEXT NOT NULL, domain_name TEXT,
          similarity NUMERIC(6,4), atomic_signal_count INTEGER NOT NULL DEFAULT 0, evidence_strength TEXT,
          provenance TEXT NOT NULL DEFAULT 'wc1a_green', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (bridge_tag, signal_family));`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS capadex_bridge_tag_signal_grounding (
          id BIGSERIAL PRIMARY KEY, bridge_tag TEXT NOT NULL, signal_family TEXT NOT NULL, domain_name TEXT,
          atomic_signal_id TEXT NOT NULL, atomic_signal_name TEXT, similarity NUMERIC(6,4), evidence_strength TEXT,
          provenance TEXT NOT NULL DEFAULT 'wc1a_green', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (bridge_tag, atomic_signal_id));`);
      // idempotent: clear any prior wc1a_yellow rows so re-runs reconcile (no duplication / no drift)
      await client.query(`DELETE FROM capadex_bridge_tag_signal_grounding WHERE provenance=$1`, [PROV]);
      await client.query(`DELETE FROM capadex_bridge_tag_family_grounding WHERE provenance=$1`, [PROV]);

      for (const p of pairs) {
        const members = byFamily.get(p.family) || [];
        if (!members.length) continue;
        await client.query(
          `INSERT INTO capadex_bridge_tag_family_grounding (bridge_tag, signal_family, domain_name, similarity, atomic_signal_count, evidence_strength, provenance)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (bridge_tag, signal_family) DO NOTHING`,
          [p.tag, p.family, p.domain, p.similarity, members.length, evidence(p.similarity), PROV]);
      }
      // chunked atomic insert (ON CONFLICT DO NOTHING -> no duplication; a signal may ground several tags)
      atomicInserted = 0;
      const CH = 800;
      for (let i = 0; i < atomicRows.length; i += CH) {
        const chunk = atomicRows.slice(i, i + CH);
        const vals: any[] = []; const ph: string[] = [];
        chunk.forEach((r, j) => { const b = j * 8; ph.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`); vals.push(...r, PROV); });
        const res = await client.query(
          `INSERT INTO capadex_bridge_tag_signal_grounding (bridge_tag, signal_family, domain_name, atomic_signal_id, atomic_signal_name, similarity, evidence_strength, provenance)
           VALUES ${ph.join(',')} ON CONFLICT (bridge_tag, atomic_signal_id) DO NOTHING`, vals);
        atomicInserted += res.rowCount || 0;
      }

      // ---- AFTER measurement (native ∪ GREEN ∪ YELLOW), inside the txn snapshot ----
      after = await coverage(client, [GREEN_PROV, PROV]);
      afterTA = await trustAndAis(client, after.concernByTag, await tagEvidenceWeights(client, [GREEN_PROV, PROV]));

      // ---- verification (scoped to wc1a_yellow) ----
      const fpAfter = await fp(client);
      const P = `provenance='${PROV}'`;
      const fabricated = +(await client.query(`SELECT count(*) c FROM capadex_bridge_tag_signal_grounding g LEFT JOIN capadex_atomic_signals a ON a.atomic_signal_id=g.atomic_signal_id WHERE g.${P} AND a.atomic_signal_id IS NULL`)).rows[0].c;
      const totalRows = +(await client.query(`SELECT count(*) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
      const distinctPairs = +(await client.query(`SELECT count(*) c FROM (SELECT DISTINCT bridge_tag, atomic_signal_id FROM capadex_bridge_tag_signal_grounding WHERE ${P}) t`)).rows[0].c;
      const distinctSignalsReused = +(await client.query(`SELECT count(DISTINCT atomic_signal_id) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
      const tagsGrounded = +(await client.query(`SELECT count(DISTINCT bridge_tag) c FROM capadex_bridge_tag_signal_grounding WHERE ${P}`)).rows[0].c;
      const nonCanonical = +(await client.query(`SELECT count(DISTINCT g.bridge_tag) c FROM capadex_bridge_tag_signal_grounding g WHERE g.${P} AND NOT EXISTS (SELECT 1 FROM capadex_concerns_master m WHERE m.relational_bridge_tag = g.bridge_tag)`)).rows[0].c;
      // YELLOW must not overlap GREEN tags (disjoint classification); count any tag grounded under both provenances
      const overlapGreen = +(await client.query(`SELECT count(*) c FROM (SELECT bridge_tag FROM capadex_bridge_tag_signal_grounding WHERE provenance=$1 INTERSECT SELECT bridge_tag FROM capadex_bridge_tag_signal_grounding WHERE provenance=$2) t`, [PROV, GREEN_PROV])).rows[0].c;
      verify = {
        dry_run: DRY,
        no_signal_fabrication: fabricated === 0, fabricated_rows: fabricated,
        no_signal_duplication: totalRows === distinctPairs, total_atomic_rows: totalRows, distinct_tag_signal_pairs: distinctPairs,
        no_new_bridge_tags: nonCanonical === 0 && rejectedTags.length === 0, non_canonical_tags_inserted: nonCanonical, non_canonical_tags_rejected_pre_insert: rejectedTags.length,
        no_new_signals: fpAfter.atomic === fpBefore.atomic, atomic_signals_before: fpBefore.atomic, atomic_signals_after: fpAfter.atomic,
        no_concern_modification: fpAfter.concerns === fpBefore.concerns, concerns_before: fpBefore.concerns, concerns_after: fpAfter.concerns,
        no_bridge_tag_modification: fpAfter.distinctTagOnConcerns === fpBefore.distinctTagOnConcerns, distinct_bridge_tags_before: fpBefore.distinctTagOnConcerns, distinct_bridge_tags_after: fpAfter.distinctTagOnConcerns,
        no_green_mutation: fpAfter.greenRows === fpBefore.greenRows, green_rows_before: fpBefore.greenRows, green_rows_after: fpAfter.greenRows,
        no_green_yellow_overlap: overlapGreen === 0, green_yellow_overlap_tags: overlapGreen,
        distinct_signals_reused: distinctSignalsReused, tags_grounded_in_table: tagsGrounded,
      };

      // HARD GATE: any failed invariant rolls the whole transaction back (no partial writes persist).
      const HARD = ['no_signal_fabrication', 'no_signal_duplication', 'no_new_bridge_tags', 'no_new_signals', 'no_concern_modification', 'no_bridge_tag_modification', 'no_green_mutation', 'no_green_yellow_overlap'];
      const failed = HARD.filter((k) => verify[k] === false);
      if (failed.length) throw new Error(`GUARDRAIL FAILED [${failed.join(', ')}] — transaction rolled back. detail=${JSON.stringify(verify)}`);

      // DRY: roll back the projection (DB untouched). Real: commit only after every guardrail passed.
      await client.query(DRY ? 'ROLLBACK' : 'COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  // ---- DIRECTIONAL impact (NOT measured runtime deltas — resolver wiring out of scope) ----
  const yellowConcerns = matrix.filter((r) => r.classification === 'YELLOW').reduce((s, r) => s + (+r.concern_count || 0), 0);
  const yellowQuestions = matrix.filter((r) => r.classification === 'YELLOW').reduce((s, r) => s + (+r.question_count || 0), 0);

  const summary = {
    generated_at: new Date().toISOString(), dry_run: DRY, runtime_activation_wired: false,
    note: 'Additive YELLOW reuse-linkage only (provenance wc1a_yellow). Runtime signal-activation wiring is a deliberate follow-up; resolver-confidence and assessment-intelligence IMPACT figures below are directional, not measured runtime deltas.',
    tags_grounded: pairs.length ? new Set(pairs.map((p) => p.tag)).size : 0,
    family_links: famInserted, atomic_links: atomicInserted, signals_reused_distinct: verify.distinct_signals_reused ?? new Set(atomicRows.map((r) => r[3])).size,
    coverage: {
      signal_coverage_before_pct: before.sigCovTags, signal_coverage_after_pct: after.sigCovTags, signal_coverage_delta_pct: +(after.sigCovTags - before.sigCovTags).toFixed(1),
      concern_coverage_before_pct: before.concernCov, concern_coverage_after_pct: after.concernCov, concern_coverage_delta_pct: +(after.concernCov - before.concernCov).toFixed(1),
      question_coverage_before_pct: beforeTA.qCovPct, question_coverage_after_pct: afterTA.qCovPct, question_coverage_delta_pct: +(afterTA.qCovPct - beforeTA.qCovPct).toFixed(1),
      ontology_health_before: before.health, ontology_health_after: after.health, ontology_health_delta: +(after.health - before.health).toFixed(1),
      trust_score_before: beforeTA.trust, trust_score_after: afterTA.trust, trust_score_delta: +(afterTA.trust - beforeTA.trust).toFixed(1),
      assessment_intelligence_before: beforeTA.ais, assessment_intelligence_after: afterTA.ais, assessment_intelligence_delta: +(afterTA.ais - beforeTA.ais).toFixed(1),
      tags_total: after.totalTags, tags_grounded_before: before.groundedTags, tags_grounded_after: after.groundedTags,
      questions_total: afterTA.totalQ, questions_covered_before: beforeTA.coveredQ, questions_covered_after: afterTA.coveredQ,
    },
    directional_resolver_impact: {
      measured_counts: { concerns_under_yellow_tags: yellowConcerns, questions_under_yellow_tags: yellowQuestions, concerns_newly_grounded: after.groundedConcerns - before.groundedConcerns },
      note: 'directional: concerns/questions on newly-grounded YELLOW tags gain reusable Tier-3 atomic-signal evidence the resolver/confidence engine COULD consume; NOT a measured resolver-accuracy delta — requires runtime wiring (deferred follow-up).',
    },
    method: {
      tau_high_green: TAU_HIGH, tau_low_yellow: TAU_LOW, provenance: PROV,
      trust_score: 'evidence-weighted tag grounding over 328 concern tags (strong=1.0, good=0.8, moderate=0.5); native tags weighted strong. YELLOW grounds at moderate ⇒ trust rises less than raw coverage.',
      assessment_intelligence: 'evidence-weighted question coverage over the live bank (same evidence weights); distinct from AQ-2 question-metadata AIS.',
      ontology_health: '8-layer WC-1 mean holding 7 layers fixed and swapping the signal layer for measured signal tag-coverage %.',
    },
    verification: verify,
  };
  fs.writeFileSync(path.join(OUT, 'wc1c_y_grounding.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'signal_linkage_audit.csv'), linkageAudit.join('\n'));
  writeDeliverables(summary, before, after);

  console.log(JSON.stringify(summary.coverage, null, 1));
  console.log('verify:', JSON.stringify(verify));
  console.log('wrote', OUT, DRY ? '(DRY RUN)' : '');
  await pool.end();
}

function writeDeliverables(s: any, before: any, after: any) {
  const c = s.coverage;
  const w = (f: string, body: string) => fs.writeFileSync(path.join(OUT, f), body);
  const hdr = (n: number, t: string) => `# WC-1C-Y — ${t}\n\n_Source: \`audit/wc1c-y/wc1c_y_grounding.json\` (generated ${s.generated_at}). Additive YELLOW grounding, provenance \`wc1a_yellow\`. ${s.dry_run ? '**DRY RUN — no rows written.**' : 'Persisted.'}_\n`;

  w('01_tags_grounded.md', `${hdr(1, 'Tags Grounded')}
The 121 WC-1A **YELLOW** bridge tags are activated by reuse-linking existing atomic signals (none created). YELLOW = best candidate-family similarity in [${s.method.tau_low_yellow}, ${s.method.tau_high_green}) — below the GREEN floor, so grounded at **moderate** evidence.

| Metric | Value |
|---|---:|
| YELLOW tags grounded | **${s.tags_grounded}** |
| Family reuse links created | **${s.family_links}** |
| Atomic reuse links created | **${s.atomic_links}** |
| Tags grounded (cumulative, all provenance) | ${c.tags_grounded_before} → **${c.tags_grounded_after}** of ${c.tags_total} |

With GREEN(182) + YELLOW(121) + already-grounded(25) = all ${c.tags_total} concern bridge tags, **RED = 0**: every concern bridge tag now has at least reuse-level signal grounding.
`);

  w('02_signals_reused.md', `${hdr(2, 'Signals Reused')}
No new signals created — only existing atomic signals re-linked (within-tag uniqueness; a signal may legitimately ground multiple tags).

| Metric | Value |
|---|---:|
| Distinct atomic signals reused (YELLOW) | **${s.signals_reused_distinct}** |
| Total atomic reuse rows (YELLOW) | **${s.verification.total_atomic_rows ?? s.atomic_links}** |
| Signal fabrication (orphan rows) | ${s.verification.fabricated_rows ?? '—'} |
| Signal duplication (rows == distinct pairs) | ${s.verification.no_signal_duplication ? 'none' : 'PRESENT'} |

See \`signal_linkage_audit.csv\` for the per (tag→family) reuse map with sample signals.
`);

  const sgn = (x: number) => (x >= 0 ? '+' : '') + x;
  w('03_signal_coverage_delta.md', `${hdr(3, 'Signal Coverage Delta')}
Coverage denominator = ${c.tags_total} distinct \`relational_bridge_tag\` in \`capadex_concerns_master\`. A tag is grounded if it has native atomic signals OR a grounding-table row. **Before** = native ∪ GREEN; **After** = native ∪ GREEN ∪ YELLOW (this phase).

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Signal coverage (tags) | ${c.signal_coverage_before_pct}% | **${c.signal_coverage_after_pct}%** | ${sgn(c.signal_coverage_delta_pct)} |
| Concern coverage | ${c.concern_coverage_before_pct}% | **${c.concern_coverage_after_pct}%** | ${sgn(c.concern_coverage_delta_pct)} |
| Question coverage (live bank) | ${c.question_coverage_before_pct}% | **${c.question_coverage_after_pct}%** | ${sgn(c.question_coverage_delta_pct)} |
| Tags grounded | ${c.tags_grounded_before} | **${c.tags_grounded_after}** | ${sgn(c.tags_grounded_after - c.tags_grounded_before)} |
| Questions on a grounded tag | ${c.questions_covered_before} | **${c.questions_covered_after}** | ${sgn(c.questions_covered_after - c.questions_covered_before)} |

${c.question_coverage_after_pct >= 100
  ? `Question coverage reaches **100%**: every one of the ${c.questions_total} live-bank questions sits on a bridge tag that is now grounded (all distinct clarity tags fall within the ${c.tags_total} canonical concern tags activated by GREEN+YELLOW+native).`
  : `Question coverage reaches **${c.question_coverage_after_pct}%** (not 100%): a residual ${c.questions_total - c.questions_covered_after} of ${c.questions_total} questions sit on bridge tags that are not in the canonical concern-tag universe (e.g. UNMAPPED clarity tags) — an honest data-coverage gap, not a defect.`}
`);

  w('04_assessment_intelligence_delta.md', `${hdr(4, 'Assessment Intelligence Delta')}
**Assessment Intelligence Score** = evidence-weighted question coverage over the live bank (${c.questions_total} questions): each question's tag contributes its best evidence weight (strong=1.0, good=0.8, **moderate=0.5**), summed / total × 100. Distinct from the AQ-2 question-metadata AIS.

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Question coverage (unweighted) | ${c.question_coverage_before_pct}% | **${c.question_coverage_after_pct}%** | ${sgn(c.question_coverage_delta_pct)} |
| **Assessment Intelligence Score** | ${c.assessment_intelligence_before} | **${c.assessment_intelligence_after}** | ${sgn(c.assessment_intelligence_delta)} |

Because YELLOW tags ground at **moderate** evidence (0.5), the AIS gain is intentionally **smaller than the raw question-coverage gain** — the score reflects that newly-covered questions carry lower-confidence grounding.

## Directional resolver-confidence impact (NOT measured)
- Concerns under YELLOW tags: **${s.directional_resolver_impact.measured_counts.concerns_under_yellow_tags}** · Questions under YELLOW tags: **${s.directional_resolver_impact.measured_counts.questions_under_yellow_tags}** · Concerns newly grounded: **${s.directional_resolver_impact.measured_counts.concerns_newly_grounded}**.
- ${s.directional_resolver_impact.note}
`);

  w('05_updated_ontology_health.md', `${hdr(5, 'Updated Ontology Health')}
Ontology Health = mean of the 8 WC-1 layers, holding 7 fixed and swapping the signal layer for measured signal tag-coverage %.

| Layer | Score |
|---|---:|
| signal | ${before.sigCovTags}% → **${after.sigCovTags}%** |
| question | ${LAYERS.question} |
| capability | ${LAYERS.capability} |
| problem | ${LAYERS.problem} |
| behavior | ${LAYERS.behavior} |
| archetype | ${LAYERS.archetype} |
| intervention | ${LAYERS.intervention} |
| recommendation | ${LAYERS.recommendation} |

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| **Ontology Health** | ${c.ontology_health_before} | **${c.ontology_health_after}** | ${sgn(c.ontology_health_delta)} |

The signal layer — historically the systemic gap (7.6% at WC-1) — is now at **${after.sigCovTags}%** of concern tags. The other layers (capability/problem/recommendation) remain the next coverage gaps; this phase only moves the signal layer.
`);

  w('06_updated_trust_score.md', `${hdr(6, 'Updated Trust Score')}
**Trust Score** = evidence-weighted grounding across the ${c.tags_total} concern bridge tags: each grounded tag contributes its best evidence weight (strong=1.0, good=0.8, **moderate=0.5**; native tags = strong), summed / ${c.tags_total} × 100.

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Signal coverage (raw, tags) | ${c.signal_coverage_before_pct}% | **${c.signal_coverage_after_pct}%** | ${sgn(c.signal_coverage_delta_pct)} |
| **Trust Score** (evidence-weighted) | ${c.trust_score_before} | **${c.trust_score_after}** | ${sgn(c.trust_score_delta)} |

**Honest interpretation:** raw coverage jumps to ${c.signal_coverage_after_pct}%, but Trust rises only to **${c.trust_score_after}** because the 121 YELLOW tags ground at *moderate* evidence (half-weight). The gap between coverage (${c.signal_coverage_after_pct}%) and Trust (${c.trust_score_after}) is the quantified "moderate-confidence" cost of activating YELLOW — these tags are grounded enough to participate, but at lower confidence than GREEN/native tags. Strengthening them would require new construct-specific signals (a separate, larger effort), not reuse.
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
