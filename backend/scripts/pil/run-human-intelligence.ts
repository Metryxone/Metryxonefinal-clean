/**
 * CAPADEX PIL — Phase 3 runner: Human Intelligence Layer.
 *
 *   Translates the 22 curated archetypes (archetype_library) into human-readable,
 *   jargon-free language: per-archetype Problems, 5-Stakeholder Narratives
 *   (Student/Parent/Teacher/Counselor/Professional) and Emotion sets
 *   (Frustrations/Fears/Motivations/Growth Signals/Success Indicators).
 *
 *   Prints the required outputs: Problem / Emotion / Stakeholder Coverage, the
 *   three DETERMINISTIC validators (human realism · duplicate rate · archetype
 *   alignment) against their targets, and Top Quality Examples.
 *
 * ADDITIVE & SAFE: reads ONLY archetype_library (read-only); writes ONLY the three
 * Phase-3 tables (human_problem_library, human_emotion_library, stakeholder_narratives).
 * `replace` TRUNCATEs only those three. The validators are recomputed honestly and
 * are ALLOWED to FAIL — never tune to force a pass.
 *
 *   npx tsx backend/scripts/pil/run-human-intelligence.ts [--dry-run]
 */
import { Pool, type PoolClient } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUMAN_PACKS, STAKEHOLDERS, EMOTION_TYPES, MIN_PROBLEMS,
  checkRealism, isAligned, detectDuplicates, duplicateMembers, scoreLine, packCoverage,
  VALIDATION_TARGETS,
  type Stakeholder, type EmotionType, type ProblemVoice,
} from '../../services/pil/human-intelligence-engine.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DUP_THRESHOLD = 0.6;
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase3');

type Queryable = Pool | PoolClient;

interface ArchetypeRow { archetype_key: string; archetype_name: string; }

interface ProblemRec { archetype_key: string; archetype_name: string; voice: ProblemVoice; statement: string; realism: boolean; aligned: boolean; duplicate: boolean; }
interface EmotionRec { archetype_key: string; archetype_name: string; emotion_type: EmotionType; statement: string; realism: boolean; aligned: boolean; duplicate: boolean; }
interface NarrativeRec { archetype_key: string; archetype_name: string; stakeholder: Stakeholder; statement: string; realism: boolean; aligned: boolean; duplicate: boolean; }

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, file), body + '\n', 'utf8');
}
function pct(n: number, total: number): string {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

async function chunkedInsert(
  db: Queryable,
  build: (chunk: unknown[][]) => { text: string; values: unknown[] },
  rows: unknown[][],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = build(chunk);
    await db.query(text, values);
  }
}
function placeholders(chunk: unknown[][], cols: number): string {
  return chunk.map((_r, ri) => `(${Array.from({ length: cols }, (_v, ci) => `$${ri * cols + ci + 1}`).join(',')})`).join(',');
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS human_problem_library (
      problem_id        SERIAL PRIMARY KEY,
      archetype_key     TEXT NOT NULL,
      archetype_name    TEXT NOT NULL DEFAULT '',
      voice             TEXT NOT NULL DEFAULT 'general' CHECK (voice IN ('student','professional','general')),
      problem_statement TEXT NOT NULL,
      realism_pass      BOOLEAN NOT NULL DEFAULT true,
      aligned           BOOLEAN NOT NULL DEFAULT true,
      is_duplicate      BOOLEAN NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_key, problem_statement)
    );
    CREATE INDEX IF NOT EXISTS idx_human_problem_archetype ON human_problem_library(archetype_key);
    CREATE TABLE IF NOT EXISTS human_emotion_library (
      emotion_id     SERIAL PRIMARY KEY,
      archetype_key  TEXT NOT NULL,
      archetype_name TEXT NOT NULL DEFAULT '',
      emotion_type   TEXT NOT NULL CHECK (emotion_type IN ('frustration','fear','motivation','growth_signal','success_indicator')),
      statement      TEXT NOT NULL,
      realism_pass   BOOLEAN NOT NULL DEFAULT true,
      aligned        BOOLEAN NOT NULL DEFAULT true,
      is_duplicate   BOOLEAN NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_key, emotion_type, statement)
    );
    CREATE INDEX IF NOT EXISTS idx_human_emotion_archetype ON human_emotion_library(archetype_key);
    CREATE TABLE IF NOT EXISTS stakeholder_narratives (
      narrative_id   SERIAL PRIMARY KEY,
      archetype_key  TEXT NOT NULL,
      archetype_name TEXT NOT NULL DEFAULT '',
      stakeholder    TEXT NOT NULL CHECK (stakeholder IN ('student','parent','teacher','counselor','professional')),
      narrative      TEXT NOT NULL,
      realism_pass   BOOLEAN NOT NULL DEFAULT true,
      aligned        BOOLEAN NOT NULL DEFAULT true,
      is_duplicate   BOOLEAN NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_key, stakeholder, narrative)
    );
    CREATE INDEX IF NOT EXISTS idx_stakeholder_narr_archetype ON stakeholder_narratives(archetype_key);
  `);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── read-only input: archetype names (the curated 22) ──────────────────────
  const archetypes = (await pool.query<ArchetypeRow>(
    'SELECT archetype_key, archetype_name FROM archetype_library ORDER BY archetype_key',
  )).rows;
  const nameByKey = new Map(archetypes.map((a) => [a.archetype_key, a.archetype_name]));
  console.log(`\n[PIL 3] read ${archetypes.length} archetypes (read-only); ${Object.keys(HUMAN_PACKS).length} human packs authored`);

  const missingPacks = archetypes.filter((a) => !HUMAN_PACKS[a.archetype_key]).map((a) => a.archetype_key);
  const orphanPacks = Object.keys(HUMAN_PACKS).filter((k) => !nameByKey.has(k));
  if (missingPacks.length) console.log(`  ! archetypes WITHOUT a human pack (no rows authored): ${missingPacks.join(', ')}`);
  if (orphanPacks.length) console.log(`  ! human packs with NO matching archetype (skipped): ${orphanPacks.join(', ')}`);

  // ── generate from curated packs (only for archetypes that actually exist) ──
  const problems: ProblemRec[] = [];
  const emotions: EmotionRec[] = [];
  const narratives: NarrativeRec[] = [];

  for (const a of archetypes) {
    const pack = HUMAN_PACKS[a.archetype_key];
    if (!pack) continue; // honest: an archetype without curated copy gets NO fabricated rows
    const name = a.archetype_name;

    // per-archetype duplicate detection over each line list
    const probDups = duplicateMembers(pack.problems.map((p) => p.text), DUP_THRESHOLD);
    for (const p of pack.problems) {
      const r = checkRealism(p.text);
      problems.push({ archetype_key: a.archetype_key, archetype_name: name, voice: p.voice, statement: p.text, realism: r.pass, aligned: isAligned(p.text, a.archetype_key), duplicate: probDups.has(p.text) });
    }
    const emoDups = duplicateMembers(pack.emotions.map((e) => e.text), DUP_THRESHOLD);
    for (const e of pack.emotions) {
      const r = checkRealism(e.text);
      emotions.push({ archetype_key: a.archetype_key, archetype_name: name, emotion_type: e.type, statement: e.text, realism: r.pass, aligned: isAligned(e.text, a.archetype_key), duplicate: emoDups.has(e.text) });
    }
    const narrDups = duplicateMembers(pack.stakeholders.map((s) => s.text), DUP_THRESHOLD);
    for (const s of pack.stakeholders) {
      const r = checkRealism(s.text);
      narratives.push({ archetype_key: a.archetype_key, archetype_name: name, stakeholder: s.stakeholder, statement: s.text, realism: r.pass, aligned: isAligned(s.text, a.archetype_key), duplicate: narrDups.has(s.text) });
    }
  }

  const allLines = [...problems, ...emotions, ...narratives];

  // ── duplicate detection over the ENTIRE corpus (subsumes within-archetype:
  //    any line that is the later member of an identical/near-identical pair —
  //    same archetype OR across DIFFERENT archetypes — counts as a duplicate).
  //    This makes the reported duplicate rate honest by construction (the per-
  //    archetype flags set above are overwritten with the stricter global set).
  const globalDupPairs = detectDuplicates(allLines.map((l) => l.statement), DUP_THRESHOLD)
    .filter((d) => d.reason === 'identical' || d.overlap >= DUP_THRESHOLD);
  const globalDupMembers = duplicateMembers(allLines.map((l) => l.statement), DUP_THRESHOLD);
  for (const l of allLines) l.duplicate = globalDupMembers.has(l.statement);

  // ── validators (honest, may FAIL) ──────────────────────────────────────────
  const realismOk = allLines.filter((l) => l.realism).length;
  const alignedOk = allLines.filter((l) => l.aligned).length;
  const globalDupCount = allLines.filter((l) => l.duplicate).length;
  const total = allLines.length;
  const realismRate = total ? realismOk / total : 0;
  const alignRate = total ? alignedOk / total : 0;
  const dupRate = total ? globalDupCount / total : 0;

  // ── coverage ───────────────────────────────────────────────────────────────
  const coverage = archetypes
    .filter((a) => HUMAN_PACKS[a.archetype_key])
    .map((a) => packCoverage(a.archetype_key, HUMAN_PACKS[a.archetype_key]));
  const problemsCovered = coverage.filter((c) => c.problems_ok).length;
  const stakeholdersCovered = coverage.filter((c) => c.stakeholders_ok).length;
  const emotionsCovered = coverage.filter((c) => c.emotions_ok).length;
  const archetypesCovered = coverage.length;

  // ── CSV artifacts ────────────────────────────────────────────────────────────
  writeCsv('human_problem_library.csv',
    ['archetype_key', 'archetype_name', 'voice', 'problem_statement', 'realism_pass', 'aligned', 'is_duplicate'],
    problems.map((p) => [p.archetype_key, p.archetype_name, p.voice, p.statement, p.realism, p.aligned, p.duplicate]));
  writeCsv('human_emotion_library.csv',
    ['archetype_key', 'archetype_name', 'emotion_type', 'statement', 'realism_pass', 'aligned', 'is_duplicate'],
    emotions.map((e) => [e.archetype_key, e.archetype_name, e.emotion_type, e.statement, e.realism, e.aligned, e.duplicate]));
  writeCsv('stakeholder_narratives.csv',
    ['archetype_key', 'archetype_name', 'stakeholder', 'narrative', 'realism_pass', 'aligned', 'is_duplicate'],
    narratives.map((n) => [n.archetype_key, n.archetype_name, n.stakeholder, n.statement, n.realism, n.aligned, n.duplicate]));
  writeCsv('human_coverage.csv',
    ['archetype_key', 'problem_count', 'stakeholders_covered', 'emotion_categories_covered', 'problems_ok', 'stakeholders_ok', 'emotions_ok'],
    coverage.map((c) => [c.archetype_key, c.problem_count, c.stakeholders_covered, c.emotion_categories_covered, c.problems_ok, c.stakeholders_ok, c.emotions_ok]));
  writeCsv('global_duplicate_review.csv',
    ['statement_a', 'statement_b', 'reason', 'overlap'],
    globalDupPairs.map((d) => [d.a, d.b, d.reason, d.overlap]));

  // ── persist (single transaction) ─────────────────────────────────────────────
  if (!DRY_RUN) {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE human_problem_library, human_emotion_library, stakeholder_narratives RESTART IDENTITY');

      if (problems.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO human_problem_library (archetype_key, archetype_name, voice, problem_statement, realism_pass, aligned, is_duplicate) VALUES ${placeholders(chunk, 7)}`,
        values: chunk.flat(),
      }), problems.map((p) => [p.archetype_key, p.archetype_name, p.voice, p.statement, p.realism, p.aligned, p.duplicate]));

      if (emotions.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO human_emotion_library (archetype_key, archetype_name, emotion_type, statement, realism_pass, aligned, is_duplicate) VALUES ${placeholders(chunk, 7)}`,
        values: chunk.flat(),
      }), emotions.map((e) => [e.archetype_key, e.archetype_name, e.emotion_type, e.statement, e.realism, e.aligned, e.duplicate]));

      if (narratives.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO stakeholder_narratives (archetype_key, archetype_name, stakeholder, narrative, realism_pass, aligned, is_duplicate) VALUES ${placeholders(chunk, 7)}`,
        values: chunk.flat(),
      }), narratives.map((n) => [n.archetype_key, n.archetype_name, n.stakeholder, n.statement, n.realism, n.aligned, n.duplicate]));

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── required audit outputs ───────────────────────────────────────────────────
  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`\n${tag}=== PHASE 3 — HUMAN INTELLIGENCE LAYER ===`);
  console.log(`\nGenerated ${problems.length} problems · ${narratives.length} stakeholder narratives · ${emotions.length} emotions  (= ${total} human lines) across ${archetypesCovered} archetypes.`);

  console.log('\n## Coverage');
  console.log(`  Archetypes with \u2265${MIN_PROBLEMS} problems:                ${problemsCovered}/${archetypesCovered}  ${pct(problemsCovered, archetypesCovered)}`);
  console.log(`  Archetypes with all 5 stakeholder voices:    ${stakeholdersCovered}/${archetypesCovered}  ${pct(stakeholdersCovered, archetypesCovered)}`);
  console.log(`  Archetypes with all 5 emotion categories:    ${emotionsCovered}/${archetypesCovered}  ${pct(emotionsCovered, archetypesCovered)}`);
  console.log(`  Problem voice spread: ${(['student', 'professional', 'general'] as ProblemVoice[]).map((v) => `${v}=${problems.filter((p) => p.voice === v).length}`).join('  ')}`);

  console.log('\n## Emotion Distribution (by category)');
  for (const t of EMOTION_TYPES) {
    const n = emotions.filter((e) => e.emotion_type === t).length;
    console.log(`  ${t.padEnd(20)} ${String(n).padStart(5)}  ${pct(n, emotions.length)}`);
  }

  console.log('\n## Stakeholder Distribution');
  for (const s of STAKEHOLDERS) {
    const n = narratives.filter((x) => x.stakeholder === s).length;
    console.log(`  ${s.padEnd(20)} ${String(n).padStart(5)}  ${pct(n, narratives.length)}`);
  }

  console.log('\n## Validation (REAL — allowed to fail)');
  const verdict = (rate: number, target: number, lessIsBetter = false) =>
    (lessIsBetter ? rate <= target : rate >= target) ? 'PASS' : 'FAIL';
  console.log(`  Human realism (jargon-free):  ${(realismRate * 100).toFixed(1)}%  target \u2265${(VALIDATION_TARGETS.human_realism * 100).toFixed(0)}%  \u2192 ${verdict(realismRate, VALIDATION_TARGETS.human_realism)}`);
  console.log(`  Duplicate rate:               ${(dupRate * 100).toFixed(1)}%  target \u2264${(VALIDATION_TARGETS.duplicate_rate_max * 100).toFixed(0)}%  \u2192 ${verdict(dupRate, VALIDATION_TARGETS.duplicate_rate_max, true)}`);
  console.log(`  Archetype alignment:          ${(alignRate * 100).toFixed(1)}%  target \u2265${(VALIDATION_TARGETS.archetype_alignment * 100).toFixed(0)}%  \u2192 ${verdict(alignRate, VALIDATION_TARGETS.archetype_alignment)}`);
  console.log(`  (duplicates flagged corpus-wide: ${globalDupCount} · cross-archetype near-dup pairs: ${globalDupPairs.length})`);

  if (realismOk < total) {
    console.log('\n## Realism failures (lines containing jargon or out-of-range length)');
    for (const l of allLines.filter((x) => !x.realism).slice(0, 20)) {
      console.log(`  [${l.archetype_key}] "${l.statement}" \u2192 ${checkRealism(l.statement).reason}`);
    }
  }
  if (alignedOk < total) {
    console.log('\n## Alignment failures (lines not touching the archetype lay-lexicon)');
    for (const l of allLines.filter((x) => !x.aligned).slice(0, 20)) {
      console.log(`  [${l.archetype_key}] "${l.statement}"`);
    }
  }

  console.log('\n## Top Quality Examples (realistic + aligned + distinct)');
  const ranked = allLines
    .map((l) => ({ l, q: scoreLine(l.statement, l.archetype_key, !l.duplicate) }))
    .filter((x) => x.q.realism && x.q.aligned && x.q.distinct)
    .sort((a, b) => b.q.score - a.q.score || b.q.word_count - a.q.word_count);
  const shownKeys = new Set<string>();
  let shown = 0;
  for (const x of ranked) {
    if (shownKeys.has(x.l.archetype_key)) continue; // one best line per archetype for variety
    shownKeys.add(x.l.archetype_key);
    console.log(`  [${x.l.archetype_name}] "${x.l.statement}"`);
    if (++shown >= 12) break;
  }

  console.log(`\nCSV artifacts \u2192 ${OUT_DIR}`);
  console.log(DRY_RUN ? '[DRY-RUN] no DB writes performed.\n' : '[WRITE] persisted to 3 Phase-3 tables.\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
