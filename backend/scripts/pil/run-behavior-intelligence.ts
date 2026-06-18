/**
 * CAPADEX PIL — Phase 1.6 runner: Behavioral Intelligence Layer.
 *
 *   Sub-phases: 1.6A generate behaviors → 1.6B classify (8 categories) → 1.6C
 *   severity variants → 1.6D age-band variants → 1.6E capability_problem_behavior_map
 *   → 1.6F quality scoring (reject total < 15) → 1.6G duplicate review → 1.6H family
 *   coverage audit. Prints the required outputs (Behavior Distribution, Severity
 *   Distribution, Top Behavior Families, Coverage Audit, Explainability Readiness).
 *
 * ADDITIVE & SAFE: reads ONLY the Phase-1.5 extension tables (read-only); writes
 * ONLY the six Phase-1.6 extension tables. `replace` mode TRUNCATEs only those.
 * Pass --dry-run to compute + export CSVs + print the audit WITHOUT touching the DB.
 *
 *   npx tsx backend/scripts/pil/run-behavior-intelligence.ts [--dry-run]
 */
import { Pool, type PoolClient } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateBehaviors, scoreQuality, expandStatement, detectDuplicates,
  mappingConfidence, explainabilityReadiness, inferCategory, tokenize,
  BEHAVIOR_CATEGORIES, SEVERITIES, AGE_BANDS,
  type BehaviorCategory, type Severity, type AgeBand, type QualityScore,
} from '../../services/pil/behavior-intelligence-engine.js';

const DRY_RUN = process.argv.includes('--dry-run');
const MIN_BEHAVIORS = 3;
const MAX_BEHAVIORS = 5;
const DUP_THRESHOLD = 0.6;
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase1_6');

const CATEGORY_DESC: Record<BehaviorCategory, string> = {
  Academic: 'Observable study, coursework and exam behaviors.',
  Career: 'Observable workplace, professional growth and career-action behaviors.',
  Social: 'Observable communication, collaboration and peer-interaction behaviors.',
  Emotional: 'Observable stress, anxiety, mood and confidence behaviors.',
  Cognitive: 'Observable focus, thinking, decision and comprehension behaviors.',
  Leadership: 'Observable influence, delegation and direction-setting behaviors.',
  'Self-Management': 'Observable time, planning, discipline and ownership behaviors.',
  Learning: 'Observable curiosity, feedback-use and skill-growth behaviors.',
};

interface OntologyRow { concern_id: string; concern_name: string; canonical_type: string; confidence_score: string; }
interface CapPair { capability_concern_id: string; capability_name: string; problem_concern_id: string; problem_name: string; confidence_score: string; }
interface FamilyRow { family_name: string; concern_count: number; primary_concern_ids: string[]; }

interface BehaviorRecord {
  concern_id: string;
  concern_name: string;
  canonical_type: string;
  statement: string;
  category: BehaviorCategory;
  frame_id: string;
  source: 'curated' | 'generic_fallback';
  quality: QualityScore;
}

type Queryable = Pool | PoolClient;

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
  build: (rows: unknown[][]) => { text: string; values: unknown[] },
  rows: unknown[][],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = build(chunk);
    await db.query(text, values);
  }
}
function valuesPlaceholders(rows: unknown[][], cols: number): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const groups = rows.map((r, ri) => {
    const ph = r.map((_v, ci) => `$${ri * cols + ci + 1}`);
    values.push(...r);
    return `(${ph.join(',')})`;
  });
  return { text: groups.join(','), values };
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS behavior_categories (
      category_id SERIAL PRIMARY KEY,
      category_name TEXT NOT NULL UNIQUE
        CHECK (category_name IN ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')),
      description TEXT NOT NULL DEFAULT '',
      behavior_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS behavior_library (
      behavior_id SERIAL PRIMARY KEY,
      concern_id TEXT NOT NULL,
      concern_name TEXT NOT NULL DEFAULT '',
      canonical_type TEXT NOT NULL DEFAULT '',
      behavior_statement TEXT NOT NULL,
      behavior_category TEXT NOT NULL
        CHECK (behavior_category IN ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')),
      frame_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'curated' CHECK (source IN ('curated','generic_fallback')),
      quality_total INTEGER NOT NULL DEFAULT 0,
      accepted BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (concern_id, behavior_statement)
    );
    CREATE TABLE IF NOT EXISTS behavior_quality_scores (
      score_id SERIAL PRIMARY KEY,
      behavior_id INTEGER NOT NULL REFERENCES behavior_library(behavior_id) ON DELETE CASCADE,
      observability INTEGER NOT NULL CHECK (observability BETWEEN 1 AND 5),
      human_realism INTEGER NOT NULL CHECK (human_realism BETWEEN 1 AND 5),
      distinctiveness INTEGER NOT NULL CHECK (distinctiveness BETWEEN 1 AND 5),
      actionability INTEGER NOT NULL CHECK (actionability BETWEEN 1 AND 5),
      total_score INTEGER NOT NULL CHECK (total_score BETWEEN 4 AND 20),
      accepted BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (behavior_id)
    );
    CREATE TABLE IF NOT EXISTS capability_problem_behavior_map (
      mapping_id SERIAL PRIMARY KEY,
      capability_id TEXT NOT NULL,
      capability_name TEXT NOT NULL DEFAULT '',
      problem_id TEXT NOT NULL,
      problem_name TEXT NOT NULL DEFAULT '',
      behavior_id INTEGER NOT NULL REFERENCES behavior_library(behavior_id) ON DELETE CASCADE,
      behavior_statement TEXT NOT NULL,
      behavior_category TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('Mild','Moderate','Significant')),
      age_band TEXT NOT NULL CHECK (age_band IN ('10-13','14-18','19-25','26-40','40+')),
      confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (behavior_id, severity, age_band)
    );
    CREATE INDEX IF NOT EXISTS idx_cpb_map_capability ON capability_problem_behavior_map(capability_id);
    CREATE INDEX IF NOT EXISTS idx_cpb_map_problem ON capability_problem_behavior_map(problem_id);
    CREATE TABLE IF NOT EXISTS behavior_duplicate_review (
      review_id SERIAL PRIMARY KEY,
      concern_id TEXT NOT NULL,
      behavior_a TEXT NOT NULL,
      behavior_b TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('identical','semantic')),
      overlap NUMERIC(5,3) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS family_behavior_coverage (
      coverage_id SERIAL PRIMARY KEY,
      family_name TEXT NOT NULL UNIQUE,
      concern_count INTEGER NOT NULL,
      concerns_covered INTEGER NOT NULL,
      coverage_pct NUMERIC(5,2) NOT NULL,
      avg_behaviors NUMERIC(6,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── read-only inputs ───────────────────────────────────────────────────────
  const ontology = (await pool.query<OntologyRow>(
    'SELECT concern_id, concern_name, canonical_type, confidence_score FROM normalized_concern_ontology',
  )).rows;
  const capPairs = (await pool.query<CapPair>(
    'SELECT capability_concern_id, capability_name, problem_concern_id, problem_name, confidence_score FROM capability_problem_map',
  )).rows;
  const families = (await pool.query<FamilyRow>(
    'SELECT family_name, concern_count, primary_concern_ids FROM concern_families',
  )).rows;
  console.log(`\n[PIL 1.6] read ${ontology.length} concerns, ${capPairs.length} cap↔problem pairs, ${families.length} families (read-only)`);

  // ── 1.6A–1.6D / 1.6F / 1.6G — generate, classify, severity/age, quality, dup ─
  const behaviors: BehaviorRecord[] = [];
  const dupRows: { concern_id: string; a: string; b: string; reason: string; overlap: number }[] = [];
  const acceptedByConcern = new Map<string, number>();
  const allByConcern = new Map<string, number>();
  const conceptConfidence = new Map<string, number>();

  for (const c of ontology) {
    conceptConfidence.set(c.concern_id, Number(c.confidence_score) || 0.5);
    const gen = generateBehaviors(
      { concern_id: c.concern_id, concern_name: c.concern_name },
      { min: MIN_BEHAVIORS, max: MAX_BEHAVIORS },
    );
    // distinctiveness: a statement is distinct if no other in the set is a near-dup of it
    const stmts = gen.map((g) => g.statement);
    const dups = detectDuplicates(stmts, DUP_THRESHOLD);
    const nonDistinct = new Set(dups.map((d) => d.b)); // later member of each dup pair
    for (const d of dups) dupRows.push({ concern_id: c.concern_id, a: d.a, b: d.b, reason: d.reason, overlap: d.overlap });

    let accepted = 0;
    for (const g of gen) {
      const q = scoreQuality(g, !nonDistinct.has(g.statement));
      if (q.accepted) accepted++;
      behaviors.push({
        concern_id: c.concern_id, concern_name: c.concern_name, canonical_type: c.canonical_type,
        statement: g.statement, category: g.category, frame_id: g.frame_id, source: g.source, quality: q,
      });
    }
    acceptedByConcern.set(c.concern_id, accepted);
    allByConcern.set(c.concern_id, gen.length);
  }

  // ── 1.6B — category counts ───────────────────────────────────────────────────
  const catCounts: Record<BehaviorCategory, number> = Object.fromEntries(
    BEHAVIOR_CATEGORIES.map((c) => [c, 0]),
  ) as Record<BehaviorCategory, number>;
  for (const b of behaviors) catCounts[b.category]++;

  // ── 1.6E — capability_problem_behavior_map (× severity × age over ACCEPTED) ──
  // built after we know behavior_id (post-insert); here we assemble the plan.
  interface MapPlan { capability_id: string; capability_name: string; problem_id: string; problem_name: string; key: string; severity: Severity; age_band: AgeBand; statement: string; category: BehaviorCategory; confidence: number; }
  const behByConcern = new Map<string, BehaviorRecord[]>();
  for (const b of behaviors) {
    if (!b.quality.accepted) continue;
    (behByConcern.get(b.concern_id) ?? behByConcern.set(b.concern_id, []).get(b.concern_id)!).push(b);
  }
  const mapPlans: MapPlan[] = [];
  for (const p of capPairs) {
    const accepted = behByConcern.get(p.problem_concern_id) ?? [];
    const conf = Number(p.confidence_score) || 0.5;
    for (const b of accepted) {
      for (const sev of SEVERITIES) {
        for (const age of AGE_BANDS) {
          mapPlans.push({
            capability_id: p.capability_concern_id, capability_name: p.capability_name,
            problem_id: p.problem_concern_id, problem_name: p.problem_name,
            key: `${b.concern_id}\u0000${b.statement}`,
            severity: sev, age_band: age,
            statement: expandStatement(b.statement, sev, age),
            category: b.category,
            confidence: mappingConfidence(b.quality, conf, b.source),
          });
        }
      }
    }
  }

  // ── 1.6H — family behavior coverage ──────────────────────────────────────────
  const familyCoverage = families.map((f) => {
    const ids = Array.isArray(f.primary_concern_ids) ? f.primary_concern_ids : [];
    let covered = 0; let behSum = 0; let counted = 0;
    for (const id of ids) {
      const acc = acceptedByConcern.get(id);
      if (acc === undefined) continue;
      counted++;
      if (acc >= MIN_BEHAVIORS) covered++;
      behSum += acc;
    }
    const denom = counted || ids.length || 1;
    return {
      family_name: f.family_name,
      concern_count: f.concern_count,
      concerns_covered: covered,
      coverage_pct: Math.round((covered / denom) * 10000) / 100,
      avg_behaviors: Math.round((behSum / denom) * 100) / 100,
    };
  });

  // ── readiness inputs ─────────────────────────────────────────────────────────
  const concernsTotal = ontology.length;
  const concernsWithBehaviors = [...acceptedByConcern.values()].filter((n) => n >= MIN_BEHAVIORS).length;
  const capIds = new Set(capPairs.map((p) => p.capability_concern_id));
  const probIds = new Set(capPairs.map((p) => p.problem_concern_id));
  const capMapped = new Set([...capIds].filter((id) => (behByConcern.get(id)?.length ?? 0) > 0));
  const probMapped = new Set([...probIds].filter((id) => (behByConcern.get(id)?.length ?? 0) > 0));
  const acceptedBehaviors = behaviors.filter((b) => b.quality.accepted);
  const avgQualityNorm = acceptedBehaviors.length
    ? acceptedBehaviors.reduce((s, b) => s + b.quality.total / 20, 0) / acceptedBehaviors.length
    : 0;
  const readiness = explainabilityReadiness({
    concernsTotal, concernsWithBehaviors,
    capabilitiesMapped: capMapped.size, capabilitiesTotal: capIds.size,
    problemsMapped: probMapped.size, problemsTotal: probIds.size,
    avgQualityNorm,
  });

  // ── CSV artifacts ────────────────────────────────────────────────────────────
  writeCsv('behavior_library.csv',
    ['concern_id', 'concern_name', 'canonical_type', 'behavior_statement', 'behavior_category', 'frame_id', 'source', 'quality_total', 'accepted'],
    behaviors.map((b) => [b.concern_id, b.concern_name, b.canonical_type, b.statement, b.category, b.frame_id, b.source, b.quality.total, b.quality.accepted]));
  writeCsv('behavior_quality_scores.csv',
    ['concern_id', 'behavior_statement', 'observability', 'human_realism', 'distinctiveness', 'actionability', 'total', 'accepted'],
    behaviors.map((b) => [b.concern_id, b.statement, b.quality.observability, b.quality.human_realism, b.quality.distinctiveness, b.quality.actionability, b.quality.total, b.quality.accepted]));
  writeCsv('capability_problem_behavior_map.csv',
    ['capability_id', 'capability_name', 'problem_id', 'problem_name', 'behavior_statement', 'behavior_category', 'severity', 'age_band', 'confidence_score'],
    mapPlans.map((m) => [m.capability_id, m.capability_name, m.problem_id, m.problem_name, m.statement, m.category, m.severity, m.age_band, m.confidence]));
  writeCsv('behavior_duplicate_review.csv',
    ['concern_id', 'behavior_a', 'behavior_b', 'reason', 'overlap'],
    dupRows.map((d) => [d.concern_id, d.a, d.b, d.reason, d.overlap]));
  writeCsv('family_behavior_coverage.csv',
    ['family_name', 'concern_count', 'concerns_covered', 'coverage_pct', 'avg_behaviors'],
    familyCoverage.map((f) => [f.family_name, f.concern_count, f.concerns_covered, f.coverage_pct, f.avg_behaviors]));

  // ── persist (single transaction) ─────────────────────────────────────────────
  if (!DRY_RUN) {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE behavior_categories, behavior_library, behavior_quality_scores, capability_problem_behavior_map, behavior_duplicate_review, family_behavior_coverage RESTART IDENTITY CASCADE');

      // 1.6B categories
      await chunkedInsert(client, (chunk) => {
        const { text, values } = valuesPlaceholders(chunk, 3);
        return { text: `INSERT INTO behavior_categories (category_name, description, behavior_count) VALUES ${text}`, values };
      }, BEHAVIOR_CATEGORIES.map((c) => [c, CATEGORY_DESC[c], catCounts[c]]));

      // 1.6A behavior_library
      await chunkedInsert(client, (chunk) => {
        const { text, values } = valuesPlaceholders(chunk, 8);
        return { text: `INSERT INTO behavior_library (concern_id, concern_name, canonical_type, behavior_statement, behavior_category, frame_id, source, quality_total, accepted) VALUES ${chunk.map((_r, ri) => `($${ri * 9 + 1},$${ri * 9 + 2},$${ri * 9 + 3},$${ri * 9 + 4},$${ri * 9 + 5},$${ri * 9 + 6},$${ri * 9 + 7},$${ri * 9 + 8},$${ri * 9 + 9})`).join(',')}`, values: chunk.flat() };
      }, behaviors.map((b) => [b.concern_id, b.concern_name, b.canonical_type, b.statement, b.category, b.frame_id, b.source, b.quality.total, b.quality.accepted]));

      // resolve behavior_id by (concern_id, statement)
      const idMap = new Map<string, number>();
      const idRows = (await client.query<{ behavior_id: number; concern_id: string; behavior_statement: string }>(
        'SELECT behavior_id, concern_id, behavior_statement FROM behavior_library')).rows;
      for (const r of idRows) idMap.set(`${r.concern_id}\u0000${r.behavior_statement}`, r.behavior_id);

      // 1.6F quality scores
      await chunkedInsert(client, (chunk) => {
        const { values } = valuesPlaceholders(chunk, 7);
        return { text: `INSERT INTO behavior_quality_scores (behavior_id, observability, human_realism, distinctiveness, actionability, total_score, accepted) VALUES ${chunk.map((_r, ri) => `($${ri * 7 + 1},$${ri * 7 + 2},$${ri * 7 + 3},$${ri * 7 + 4},$${ri * 7 + 5},$${ri * 7 + 6},$${ri * 7 + 7})`).join(',')}`, values };
      }, behaviors.map((b) => [idMap.get(`${b.concern_id}\u0000${b.statement}`), b.quality.observability, b.quality.human_realism, b.quality.distinctiveness, b.quality.actionability, b.quality.total, b.quality.accepted]));

      // 1.6E map
      if (mapPlans.length) await chunkedInsert(client, (chunk) => {
        const values: unknown[] = [];
        const groups = chunk.map((m: any, ri: number) => {
          values.push(m.capability_id, m.capability_name, m.problem_id, m.problem_name, idMap.get(m.key), m.statement, m.category, m.severity, m.age_band, m.confidence);
          const o = ri * 10;
          return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10})`;
        });
        return { text: `INSERT INTO capability_problem_behavior_map (capability_id, capability_name, problem_id, problem_name, behavior_id, behavior_statement, behavior_category, severity, age_band, confidence_score) VALUES ${groups.join(',')}`, values };
      }, mapPlans as unknown as unknown[][]);

      // 1.6G duplicate review
      if (dupRows.length) await chunkedInsert(client, (chunk) => {
        const { values } = valuesPlaceholders(chunk, 5);
        return { text: `INSERT INTO behavior_duplicate_review (concern_id, behavior_a, behavior_b, reason, overlap) VALUES ${chunk.map((_r, ri) => `($${ri * 5 + 1},$${ri * 5 + 2},$${ri * 5 + 3},$${ri * 5 + 4},$${ri * 5 + 5})`).join(',')}`, values };
      }, dupRows.map((d) => [d.concern_id, d.a, d.b, d.reason, d.overlap]));

      // 1.6H family coverage
      if (familyCoverage.length) await chunkedInsert(client, (chunk) => {
        const { values } = valuesPlaceholders(chunk, 5);
        return { text: `INSERT INTO family_behavior_coverage (family_name, concern_count, concerns_covered, coverage_pct, avg_behaviors) VALUES ${chunk.map((_r, ri) => `($${ri * 5 + 1},$${ri * 5 + 2},$${ri * 5 + 3},$${ri * 5 + 4},$${ri * 5 + 5})`).join(',')}`, values };
      }, familyCoverage.map((f) => [f.family_name, f.concern_count, f.concerns_covered, f.coverage_pct, f.avg_behaviors]));

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
  const totalBeh = behaviors.length;
  console.log(`\n${tag}=== PHASE 1.6 — BEHAVIORAL INTELLIGENCE AUDIT ===`);
  console.log(`\nGenerated ${totalBeh} behaviors across ${concernsTotal} concerns (${acceptedBehaviors.length} accepted, ${totalBeh - acceptedBehaviors.length} rejected).`);

  console.log('\n## Behavior Distribution (by category)');
  for (const c of BEHAVIOR_CATEGORIES) console.log(`  ${c.padEnd(16)} ${String(catCounts[c]).padStart(6)}  ${pct(catCounts[c], totalBeh)}`);

  console.log('\n## Severity Distribution (capability_problem_behavior_map rows)');
  const sevCounts: Record<Severity, number> = { Mild: 0, Moderate: 0, Significant: 0 };
  for (const m of mapPlans) sevCounts[m.severity]++;
  for (const s of SEVERITIES) console.log(`  ${s.padEnd(16)} ${String(sevCounts[s]).padStart(6)}  ${pct(sevCounts[s], mapPlans.length)}`);
  console.log(`  (each accepted behavior is expressed at all 3 severities × 5 age bands → ${mapPlans.length} map rows)`);

  console.log('\n## Top Behavior Families (concern families by behavior coverage)');
  const topFamilies = [...familyCoverage].sort((a, b) => b.coverage_pct - a.coverage_pct || b.concern_count - a.concern_count).slice(0, 15);
  for (const f of topFamilies) console.log(`  ${String(f.coverage_pct).padStart(6)}%  ${String(f.concerns_covered)}/${f.concern_count}  ${f.family_name}`);

  console.log('\n## Coverage Audit');
  console.log(`  Concerns with ≥${MIN_BEHAVIORS} accepted behaviors: ${concernsWithBehaviors}/${concernsTotal}  ${pct(concernsWithBehaviors, concernsTotal)}`);
  console.log(`  Capabilities mapped to behaviors:        ${capMapped.size}/${capIds.size}  ${pct(capMapped.size, capIds.size)}`);
  console.log(`  Problems mapped to behaviors:            ${probMapped.size}/${probIds.size}  ${pct(probMapped.size, probIds.size)}`);
  const weakFamilies = familyCoverage.filter((f) => f.coverage_pct < 50).length;
  console.log(`  Families with weak (<50%) behavior coverage: ${weakFamilies}/${familyCoverage.length}`);
  console.log(`  Duplicate behaviors flagged for review:  ${dupRows.length}`);
  console.log(`  Avg accepted-behavior quality (of 20):   ${(avgQualityNorm * 20).toFixed(2)}`);

  console.log('\n## Explainability Readiness Score');
  console.log(`  ${readiness} / 100`);
  console.log(`    (40% concern coverage · 20% capability coverage · 20% problem coverage · 20% avg quality)`);

  console.log(`\nCSV artifacts → ${OUT_DIR}`);
  console.log(DRY_RUN ? '[DRY-RUN] no DB writes performed.\n' : '[WRITE] persisted to 6 Phase-1.6 extension tables.\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
