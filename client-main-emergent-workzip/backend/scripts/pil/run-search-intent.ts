/**
 * CAPADEX PIL — Phase 4 runner: Search Intent Intelligence Layer.
 *
 *   Turns the curated archetypes into SEARCH INTELLIGENCE: per archetype × 5
 *   stakeholders × 5 intent types = 550 realistic search phrases, each scored on
 *   four 1–5 quality dimensions and linked to a real human_problem_library row
 *   (problem_id) so there are NO orphans.
 *
 *   Prints the required outputs: the three DETERMINISTIC validators (search
 *   realism · archetype alignment · duplicate rate) against their targets, SEVEN
 *   analytics, a Discovery Readiness Score, and a final recommendation — then
 *   STOPS for human approval.
 *
 * ADDITIVE & SAFE: reads ONLY archetype_library + human_problem_library (read-only);
 * writes ONLY the four Phase-4 tables. `replace` TRUNCATEs only those four. The
 * validators are recomputed honestly and are ALLOWED to FAIL — never tune to pass.
 *
 *   npx tsx backend/scripts/pil/run-search-intent.ts [--dry-run]
 */
import { Pool, type PoolClient } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  STAKEHOLDERS, INTENT_TYPES, INTENT_LABELS, SEARCH_ANCHORS,
  generateSearchIntents, scoreSearchIntent, intentFlags, auditDuplicates,
  SEARCH_VALIDATION_TARGETS,
  type Stakeholder, type IntentType, type QualityScores, type DuplicateRow,
} from '../../services/pil/search-intent-engine.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DUP_THRESHOLD = 0.6;
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase4');

type Queryable = Pool | PoolClient;
interface ArchetypeRow { archetype_key: string; archetype_name: string; }
interface ProblemRow { problem_id: number; archetype_key: string; voice: string; }

// stakeholder → preferred problem voice (falls back to general → any)
const VOICE_PREF: Record<Stakeholder, string> = {
  student: 'student',
  parent: 'general',
  teacher: 'general',
  counselor: 'general',
  professional: 'professional',
};

interface IntentRec {
  archetype_key: string;
  archetype_name: string;
  problem_id: number;
  stakeholder: Stakeholder;
  intent_type: IntentType;
  search_phrase: string;
  realism_pass: boolean;
  aligned: boolean;
  clear: boolean;
  is_duplicate: boolean;
  q: QualityScores;
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // formula-injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, file), body + '\n', 'utf8');
}
function pct(n: number, total: number): string { return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`; }
function avg(ns: number[]): number { return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0; }

function placeholders(chunk: unknown[][], cols: number): string {
  return chunk.map((_r, ri) => `(${Array.from({ length: cols }, (_v, ci) => `$${ri * cols + ci + 1}`).join(',')})`).join(',');
}
async function chunkedInsert(db: Queryable, build: (chunk: unknown[][]) => { text: string; values: unknown[] }, rows: unknown[][], size = 400): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = build(chunk);
    await db.query(text, values);
  }
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_intents (
      intent_id        SERIAL PRIMARY KEY,
      archetype_key    TEXT NOT NULL,
      archetype_name   TEXT NOT NULL DEFAULT '',
      problem_id       INTEGER NOT NULL,
      stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('student','parent','teacher','counselor','professional')),
      intent_type      TEXT NOT NULL CHECK (intent_type IN ('informational','diagnostic','emotional','help_seeking','future_planning')),
      search_phrase    TEXT NOT NULL,
      realism_pass     BOOLEAN NOT NULL DEFAULT true,
      aligned          BOOLEAN NOT NULL DEFAULT true,
      intent_clear     BOOLEAN NOT NULL DEFAULT true,
      is_duplicate     BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_key, stakeholder_type, intent_type, search_phrase)
    );
    CREATE INDEX IF NOT EXISTS idx_search_intents_archetype   ON search_intents(archetype_key);
    CREATE INDEX IF NOT EXISTS idx_search_intents_stakeholder ON search_intents(stakeholder_type);
    CREATE INDEX IF NOT EXISTS idx_search_intents_intent      ON search_intents(intent_type);
    CREATE INDEX IF NOT EXISTS idx_search_intents_problem     ON search_intents(problem_id);
    CREATE TABLE IF NOT EXISTS search_intent_quality_scores (
      score_id            SERIAL PRIMARY KEY,
      intent_id           INTEGER NOT NULL REFERENCES search_intents(intent_id) ON DELETE CASCADE,
      archetype_key       TEXT NOT NULL,
      stakeholder_type    TEXT NOT NULL,
      intent_type         TEXT NOT NULL,
      search_realism      SMALLINT NOT NULL CHECK (search_realism BETWEEN 1 AND 5),
      human_language      SMALLINT NOT NULL CHECK (human_language BETWEEN 1 AND 5),
      archetype_alignment SMALLINT NOT NULL CHECK (archetype_alignment BETWEEN 1 AND 5),
      intent_clarity      SMALLINT NOT NULL CHECK (intent_clarity BETWEEN 1 AND 5),
      composite           NUMERIC(4,2) NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (intent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_siqs_archetype ON search_intent_quality_scores(archetype_key);
    CREATE TABLE IF NOT EXISTS search_intent_duplicate_review (
      dup_id        SERIAL PRIMARY KEY,
      kind          TEXT NOT NULL CHECK (kind IN ('identical','semantic','stakeholder')),
      redundant     BOOLEAN NOT NULL DEFAULT false,
      phrase_a      TEXT NOT NULL,
      phrase_b      TEXT NOT NULL,
      overlap       NUMERIC(5,3) NOT NULL DEFAULT 0,
      archetype_a   TEXT NOT NULL DEFAULT '',
      archetype_b   TEXT NOT NULL DEFAULT '',
      stakeholder_a TEXT NOT NULL DEFAULT '',
      stakeholder_b TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS search_intent_clusters (
      cluster_id     SERIAL PRIMARY KEY,
      cluster_key    TEXT NOT NULL,
      cluster_label  TEXT NOT NULL,
      archetype_key  TEXT NOT NULL,
      archetype_name TEXT NOT NULL DEFAULT '',
      intent_type    TEXT NOT NULL,
      member_count   INTEGER NOT NULL DEFAULT 0,
      avg_composite  NUMERIC(4,2) NOT NULL DEFAULT 0,
      sample_phrase  TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (cluster_key)
    );
    CREATE INDEX IF NOT EXISTS idx_sic_archetype ON search_intent_clusters(archetype_key);
  `);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── read-only inputs ───────────────────────────────────────────────────────
  const archetypes = (await pool.query<ArchetypeRow>(
    'SELECT archetype_key, archetype_name FROM archetype_library ORDER BY archetype_key',
  )).rows;
  const nameByKey = new Map(archetypes.map((a) => [a.archetype_key, a.archetype_name]));
  const problems = (await pool.query<ProblemRow>(
    'SELECT problem_id, archetype_key, voice FROM human_problem_library ORDER BY problem_id',
  )).rows;

  // problem_id resolver: voice-pref → general → any (no orphans)
  const byArch = new Map<string, ProblemRow[]>();
  for (const p of problems) { (byArch.get(p.archetype_key) ?? byArch.set(p.archetype_key, []).get(p.archetype_key)!).push(p); }
  function resolveProblemId(archKey: string, stakeholder: Stakeholder): number | null {
    const list = byArch.get(archKey);
    if (!list || !list.length) return null;
    const pref = VOICE_PREF[stakeholder];
    return (list.find((p) => p.voice === pref) ?? list.find((p) => p.voice === 'general') ?? list[0]).problem_id;
  }

  console.log(`\n[PIL 4] read ${archetypes.length} archetypes + ${problems.length} problems (read-only); ${Object.keys(SEARCH_ANCHORS).length} search anchors authored`);
  const missingAnchor = archetypes.filter((a) => !SEARCH_ANCHORS[a.archetype_key]).map((a) => a.archetype_key);
  const noProblems = archetypes.filter((a) => !byArch.get(a.archetype_key)?.length).map((a) => a.archetype_key);
  if (missingAnchor.length) console.log(`  ! archetypes WITHOUT a search anchor (no rows authored): ${missingAnchor.join(', ')}`);
  if (noProblems.length) console.log(`  ! archetypes WITHOUT a linkable problem (intents skipped to avoid orphans): ${noProblems.join(', ')}`);

  // ── generate + score + link ────────────────────────────────────────────────
  const generated = generateSearchIntents(archetypes.map((a) => a.archetype_key));
  const { rows: dupRows, duplicateMembers } = auditDuplicates(generated, DUP_THRESHOLD);

  const intents: IntentRec[] = [];
  let skippedOrphan = 0;
  generated.forEach((g, idx) => {
    const pid = resolveProblemId(g.archetype_key, g.stakeholder);
    if (pid == null) { skippedOrphan++; return; } // honest: never persist an orphan
    const q = scoreSearchIntent(g.search_phrase, g.archetype_key, g.intent_type);
    const f = intentFlags(g.search_phrase, g.archetype_key, g.intent_type);
    intents.push({
      archetype_key: g.archetype_key,
      archetype_name: nameByKey.get(g.archetype_key) ?? '',
      problem_id: pid,
      stakeholder: g.stakeholder,
      intent_type: g.intent_type,
      search_phrase: g.search_phrase,
      realism_pass: f.realism_pass,
      aligned: f.aligned,
      clear: f.clear,
      is_duplicate: duplicateMembers.has(idx),
      q,
    });
  });

  const total = intents.length;
  const realismOk = intents.filter((i) => i.realism_pass).length;
  const alignedOk = intents.filter((i) => i.aligned).length;
  const clearOk = intents.filter((i) => i.clear).length;
  const dupCount = intents.filter((i) => i.is_duplicate).length;
  const realismRate = total ? realismOk / total : 0;
  const alignRate = total ? alignedOk / total : 0;
  const clarityRate = total ? clearOk / total : 0;
  const dupRate = total ? dupCount / total : 0;
  const orphanCount = skippedOrphan; // intents that could NOT be linked (none persisted)

  // ── clusters (archetype × intent type) ─────────────────────────────────────
  interface Cluster { cluster_key: string; cluster_label: string; archetype_key: string; archetype_name: string; intent_type: IntentType; member_count: number; avg_composite: number; sample_phrase: string; }
  const clusters: Cluster[] = [];
  for (const a of archetypes) {
    for (const it of INTENT_TYPES) {
      const members = intents.filter((i) => i.archetype_key === a.archetype_key && i.intent_type === it);
      if (!members.length) continue;
      const best = [...members].sort((x, y) => y.q.composite - x.q.composite)[0];
      clusters.push({
        cluster_key: `${a.archetype_key}::${it}`,
        cluster_label: `${nameByKey.get(a.archetype_key) ?? a.archetype_key} — ${INTENT_LABELS[it]}`,
        archetype_key: a.archetype_key,
        archetype_name: nameByKey.get(a.archetype_key) ?? '',
        intent_type: it,
        member_count: members.length,
        avg_composite: Math.round(avg(members.map((m) => m.q.composite)) * 100) / 100,
        sample_phrase: best.search_phrase,
      });
    }
  }

  // ── CSV artifacts ──────────────────────────────────────────────────────────
  writeCsv('search_intents.csv',
    ['archetype_key', 'archetype_name', 'problem_id', 'stakeholder_type', 'intent_type', 'search_phrase', 'realism_pass', 'aligned', 'intent_clear', 'is_duplicate', 'search_realism', 'human_language', 'archetype_alignment', 'intent_clarity', 'composite'],
    intents.map((i) => [i.archetype_key, i.archetype_name, i.problem_id, i.stakeholder, i.intent_type, i.search_phrase, i.realism_pass, i.aligned, i.clear, i.is_duplicate, i.q.search_realism, i.q.human_language, i.q.archetype_alignment, i.q.intent_clarity, i.q.composite]));
  writeCsv('search_intent_clusters.csv',
    ['cluster_key', 'cluster_label', 'archetype_key', 'intent_type', 'member_count', 'avg_composite', 'sample_phrase'],
    clusters.map((c) => [c.cluster_key, c.cluster_label, c.archetype_key, c.intent_type, c.member_count, c.avg_composite, c.sample_phrase]));
  writeCsv('search_intent_duplicate_review.csv',
    ['kind', 'redundant', 'phrase_a', 'phrase_b', 'overlap', 'archetype_a', 'archetype_b', 'stakeholder_a', 'stakeholder_b'],
    dupRows.map((d) => [d.kind, d.redundant, d.phrase_a, d.phrase_b, d.overlap, d.archetype_a, d.archetype_b, d.stakeholder_a, d.stakeholder_b]));

  // ── persist (single transaction) ───────────────────────────────────────────
  if (!DRY_RUN) {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE search_intents, search_intent_quality_scores, search_intent_duplicate_review, search_intent_clusters RESTART IDENTITY CASCADE');

      // intents → capture generated ids in order to link quality scores
      const intentIds: number[] = [];
      for (let i = 0; i < intents.length; i += 400) {
        const chunk = intents.slice(i, i + 400);
        const vals = chunk.flatMap((r) => [r.archetype_key, r.archetype_name, r.problem_id, r.stakeholder, r.intent_type, r.search_phrase, r.realism_pass, r.aligned, r.clear, r.is_duplicate]);
        const res = await client.query<{ intent_id: number }>(
          `INSERT INTO search_intents (archetype_key, archetype_name, problem_id, stakeholder_type, intent_type, search_phrase, realism_pass, aligned, intent_clear, is_duplicate) VALUES ${placeholders(chunk, 10)} RETURNING intent_id`,
          vals,
        );
        for (const row of res.rows) intentIds.push(row.intent_id);
      }

      const scoreRows = intents.map((r, idx) => [intentIds[idx], r.archetype_key, r.stakeholder, r.intent_type, r.q.search_realism, r.q.human_language, r.q.archetype_alignment, r.q.intent_clarity, r.q.composite]);
      if (scoreRows.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO search_intent_quality_scores (intent_id, archetype_key, stakeholder_type, intent_type, search_realism, human_language, archetype_alignment, intent_clarity, composite) VALUES ${placeholders(chunk, 9)}`,
        values: chunk.flat(),
      }), scoreRows);

      if (dupRows.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO search_intent_duplicate_review (kind, redundant, phrase_a, phrase_b, overlap, archetype_a, archetype_b, stakeholder_a, stakeholder_b) VALUES ${placeholders(chunk, 9)}`,
        values: chunk.flat(),
      }), dupRows.map((d) => [d.kind, d.redundant, d.phrase_a, d.phrase_b, d.overlap, d.archetype_a, d.archetype_b, d.stakeholder_a, d.stakeholder_b]));

      if (clusters.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO search_intent_clusters (cluster_key, cluster_label, archetype_key, archetype_name, intent_type, member_count, avg_composite, sample_phrase) VALUES ${placeholders(chunk, 8)}`,
        values: chunk.flat(),
      }), clusters.map((c) => [c.cluster_key, c.cluster_label, c.archetype_key, c.archetype_name, c.intent_type, c.member_count, c.avg_composite, c.sample_phrase]));

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── required audit outputs ─────────────────────────────────────────────────
  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`\n${tag}=== PHASE 4 — SEARCH INTENT INTELLIGENCE LAYER ===`);
  console.log(`\nGenerated ${total} search intents across ${archetypes.length} archetypes (× ${STAKEHOLDERS.length} stakeholders × ${INTENT_TYPES.length} intent types).`);

  // (1) Intent-type distribution
  console.log('\n## [1] Intent-type distribution');
  for (const it of INTENT_TYPES) {
    const n = intents.filter((i) => i.intent_type === it).length;
    console.log(`  ${INTENT_LABELS[it].padEnd(16)} ${String(n).padStart(4)}  ${pct(n, total)}`);
  }

  // (2) Stakeholder distribution
  console.log('\n## [2] Stakeholder distribution');
  for (const s of STAKEHOLDERS) {
    const n = intents.filter((i) => i.stakeholder === s).length;
    console.log(`  ${s.padEnd(16)} ${String(n).padStart(4)}  ${pct(n, total)}`);
  }

  // (3) Per-archetype coverage (all 25 combos)
  console.log('\n## [3] Per-archetype coverage (target 25 intents each)');
  const fullyCovered = archetypes.filter((a) => intents.filter((i) => i.archetype_key === a.archetype_key).length === 25).length;
  console.log(`  Archetypes with all 25 combos: ${fullyCovered}/${archetypes.length}  ${pct(fullyCovered, archetypes.length)}`);

  // (4) Quality-score averages (per dimension)
  console.log('\n## [4] Quality-score averages (1–5)');
  console.log(`  search_realism      ${avg(intents.map((i) => i.q.search_realism)).toFixed(2)}`);
  console.log(`  human_language      ${avg(intents.map((i) => i.q.human_language)).toFixed(2)}`);
  console.log(`  archetype_alignment ${avg(intents.map((i) => i.q.archetype_alignment)).toFixed(2)}`);
  console.log(`  intent_clarity      ${avg(intents.map((i) => i.q.intent_clarity)).toFixed(2)}`);
  console.log(`  composite           ${avg(intents.map((i) => i.q.composite)).toFixed(2)}`);

  // (5) Top demand clusters (by avg composite)
  console.log('\n## [5] Top demand clusters (by avg composite)');
  for (const c of [...clusters].sort((a, b) => b.avg_composite - a.avg_composite).slice(0, 8)) {
    console.log(`  ${c.avg_composite.toFixed(2)}  ${c.cluster_label}  ("${c.sample_phrase}")`);
  }

  // (6) Duplicate breakdown
  console.log('\n## [6] Duplicate review breakdown');
  const redund = dupRows.filter((d) => d.redundant).length;
  const variants = dupRows.filter((d) => !d.redundant).length;
  for (const k of ['identical', 'semantic', 'stakeholder'] as DuplicateRow['kind'][]) {
    const n = dupRows.filter((d) => d.kind === k).length;
    console.log(`  ${k.padEnd(12)} ${String(n).padStart(4)}`);
  }
  console.log(`  → redundant (counted): ${redund} · cross-audience variants (not counted): ${variants}`);

  // (7) Problem-link integrity
  console.log('\n## [7] Problem-link integrity');
  console.log(`  intents linked to a real problem_id: ${total}/${total + orphanCount}  ${pct(total, total + orphanCount)}`);
  console.log(`  ORPHANS (unlinked, not persisted):   ${orphanCount}`);

  // ── validators (REAL — may FAIL) ───────────────────────────────────────────
  console.log('\n## Validation (REAL — allowed to fail)');
  const verdict = (rate: number, target: number, lessIsBetter = false) => (lessIsBetter ? rate <= target : rate >= target) ? 'PASS' : 'FAIL';
  const vRealism = verdict(realismRate, SEARCH_VALIDATION_TARGETS.search_realism);
  const vAlign = verdict(alignRate, SEARCH_VALIDATION_TARGETS.archetype_alignment);
  const vDup = verdict(dupRate, SEARCH_VALIDATION_TARGETS.duplicate_rate_max, true);
  console.log(`  Search realism:      ${(realismRate * 100).toFixed(1)}%  target ≥${(SEARCH_VALIDATION_TARGETS.search_realism * 100).toFixed(0)}%  → ${vRealism}`);
  console.log(`  Archetype alignment: ${(alignRate * 100).toFixed(1)}%  target ≥${(SEARCH_VALIDATION_TARGETS.archetype_alignment * 100).toFixed(0)}%  → ${vAlign}`);
  console.log(`  Duplicate rate:      ${(dupRate * 100).toFixed(1)}%  target ≤${(SEARCH_VALIDATION_TARGETS.duplicate_rate_max * 100).toFixed(0)}%  → ${vDup}`);
  console.log(`  Intent clarity:      ${(clarityRate * 100).toFixed(1)}%  (clear ≥4/5)`);

  // ── Discovery Readiness Score ──────────────────────────────────────────────
  // Weighted blend of the things that decide whether this corpus is ready to
  // drive discovery: realism, alignment, clarity, low redundancy, full coverage,
  // and zero orphan links. Honest function of the metrics above.
  const coverageRate = archetypes.length ? fullyCovered / archetypes.length : 0;
  const linkRate = (total + orphanCount) ? total / (total + orphanCount) : 0;
  const drs = Math.round(
    (realismRate * 0.25 + alignRate * 0.20 + clarityRate * 0.15 + (1 - dupRate) * 0.15 + coverageRate * 0.15 + linkRate * 0.10) * 1000,
  ) / 10;
  console.log('\n## Discovery Readiness Score');
  console.log(`  DRS = ${drs.toFixed(1)} / 100`);
  console.log(`     realism 25% (${(realismRate * 100).toFixed(0)}%) · alignment 20% (${(alignRate * 100).toFixed(0)}%) · clarity 15% (${(clarityRate * 100).toFixed(0)}%) · non-dup 15% (${((1 - dupRate) * 100).toFixed(0)}%) · coverage 15% (${(coverageRate * 100).toFixed(0)}%) · link 10% (${(linkRate * 100).toFixed(0)}%)`);

  // ── final recommendation ───────────────────────────────────────────────────
  const allPass = vRealism === 'PASS' && vAlign === 'PASS' && vDup === 'PASS' && orphanCount === 0;
  console.log('\n## Recommendation');
  if (allPass && drs >= 85) {
    console.log('  ✅ READY — all validators pass, no orphan links, DRS ≥ 85. Recommend approval to persist & surface.');
  } else if (allPass) {
    console.log(`  ⚠️  CONDITIONAL — validators pass but DRS ${drs.toFixed(1)} < 85; review low-scoring clusters before surfacing.`);
  } else {
    console.log('  ❌ NOT READY — one or more validators FAILED (see above). This is a real finding; fix the underlying copy, do NOT tune metrics.');
  }

  console.log(`\nCSV artifacts → ${OUT_DIR}`);
  console.log(DRY_RUN ? '\n[DRY-RUN] no DB writes performed.' : '\n[WRITE] persisted to 4 Phase-4 tables.');
  console.log('\n=== STOP — awaiting human approval before any downstream use. ===\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
