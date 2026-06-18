/**
 * CAPADEX PIL — Phase 1.5 runner: Concern Ontology Normalization.
 *
 *   Sub-phases: 1.5A reclassify → 1.5B capability/problem map → 1.5C normalized
 *   ontology → 1.5D duplicate constructs → 1.5E concern families → 1.5F audit.
 *
 * ADDITIVE & SAFE: reads capadex_concerns_master (read-only); writes ONLY the four
 * Phase-1.5 extension tables. `replace` mode TRUNCATEs only those tables. Pass
 * --dry-run to compute + export CSVs + print the audit WITHOUT touching the DB.
 *
 *   npx tsx backend/scripts/pil/run-ontology-normalization.ts [--dry-run]
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyTypeSemantic, deriveCanonicalEntity, deriveWithinRowMapping,
  constructKey, similarPairs, connectedComponents, summarizeTypes,
  FAMILY_NAME_STOPWORDS,
  type CanonicalType, type CapProblemMapping, type KeyedItem,
} from '../../services/pil/concern-ontology-engine.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DUP_THRESHOLD = 0.7;    // 1.5D — tight near-synonyms
const FAMILY_THRESHOLD = 0.45; // 1.5E — looser construct clusters
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase1_5');

interface MasterRow {
  concern_id: string;
  display_label: string | null;
  concern_cluster: string | null;
  concern_category: string | null;
  domain: string | null;
}

interface OntologyRow {
  concern_id: string;
  concern_name: string;
  canonical_type: CanonicalType;
  canonical_entity: string;
  confidence_score: number;
  reasoning: string;
}

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

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS normalized_concern_ontology (
      ontology_id SERIAL PRIMARY KEY,
      concern_id TEXT NOT NULL UNIQUE,
      concern_name TEXT NOT NULL,
      canonical_type TEXT NOT NULL CHECK (canonical_type IN
        ('Capability','Problem','Behavior','Trait','Outcome','Risk')),
      canonical_entity TEXT NOT NULL,
      confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      reasoning TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS normalized_concern_ontology_type_idx ON normalized_concern_ontology (canonical_type);
    CREATE TABLE IF NOT EXISTS capability_problem_map (
      mapping_id SERIAL PRIMARY KEY,
      capability_concern_id TEXT NOT NULL,
      capability_name TEXT NOT NULL,
      problem_concern_id TEXT NOT NULL,
      problem_name TEXT NOT NULL,
      confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      mapping_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (capability_concern_id, problem_concern_id)
    );
    CREATE TABLE IF NOT EXISTS construct_similarity_map (
      id SERIAL PRIMARY KEY,
      concern_a TEXT NOT NULL,
      concern_b TEXT NOT NULL,
      similarity_score NUMERIC(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
      recommended_group TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (concern_a, concern_b)
    );
    CREATE TABLE IF NOT EXISTS concern_families (
      family_id SERIAL PRIMARY KEY,
      family_name TEXT NOT NULL UNIQUE,
      concern_count INTEGER NOT NULL,
      primary_concern_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

type Queryable = { query: Pool['query'] };

async function chunkedInsert(db: Queryable, sql: (rows: unknown[][]) => { text: string; values: unknown[] }, rows: unknown[][], size = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = sql(chunk);
    await db.query(text, values);
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows: master } = await pool.query<MasterRow>(
    `SELECT concern_id, display_label, concern_cluster, concern_category, domain
       FROM capadex_concerns_master ORDER BY concern_id`,
  );
  console.log(`\n[PIL 1.5] read ${master.length} concerns from capadex_concerns_master (read-only)`);

  // ── 1.5A + 1.5C — semantic reclassification → normalized ontology ──────────
  const ontology: OntologyRow[] = master.map((r) => {
    const name = (r.display_label && r.display_label.trim())
      || (r.concern_cluster && r.concern_cluster.trim())
      || (r.concern_category && r.concern_category.trim())
      || r.concern_id;
    const res = classifyTypeSemantic(name);
    return {
      concern_id: r.concern_id,
      concern_name: name,
      canonical_type: res.type,
      canonical_entity: deriveCanonicalEntity(name),
      confidence_score: res.confidence,
      reasoning: res.reasoning,
    };
  });
  const typeCounts = summarizeTypes(ontology.map((o) => o.canonical_type));

  // ── 1.5B — within-row capability ↔ problem separation ─────────────────────
  const capProblem: CapProblemMapping[] = [];
  for (const r of master) {
    const m = deriveWithinRowMapping(r);
    if (m) capProblem.push(m);
  }

  // ── 1.5D + 1.5E — similarity graph over construct keys ─────────────────────
  // Build keys from display_label ONLY (the clean construct framing); fall back to
  // concern_cluster only when display_label is absent. Including concern_cluster
  // ("Difficulty Managing …", "Weak Ability to …") would inject scaffolding tokens
  // that falsely bridge unrelated concerns.
  const keySource = (r: MasterRow) => (r.display_label && r.display_label.trim()) || r.concern_cluster;
  const items: KeyedItem[] = master.map((r) => ({
    id: r.concern_id,
    set: constructKey(keySource(r)).set,
  }));
  const confById = new Map(ontology.map((o) => [o.concern_id, o.confidence_score]));

  const dupPairs = similarPairs(items, DUP_THRESHOLD, { minShared: 2 });
  const famPairs = similarPairs(items, FAMILY_THRESHOLD, { minShared: 2 });

  // Families = connected components of the looser graph (size ≥ 2 only).
  const components = connectedComponents(master.map((r) => r.concern_id), famPairs)
    .filter((g) => g.length >= 2);
  // Stable family naming: most-frequent NON-generic topical token across members.
  const keyById = new Map(master.map((r) => [r.concern_id, constructKey(keySource(r)).ordered]));
  const familyNameSeen = new Map<string, number>();
  const families = components.map((members) => {
    const freq = new Map<string, number>();
    for (const id of members) for (const t of keyById.get(id) ?? []) freq.set(t, (freq.get(t) ?? 0) + 1);
    const tokenRank = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0]);
    const top = tokenRank.find((t) => !FAMILY_NAME_STOPWORDS.has(t)) ?? tokenRank[0] ?? 'general';
    let base = `${top.charAt(0).toUpperCase()}${top.slice(1)} Family`;
    const dupN = familyNameSeen.get(base) ?? 0;
    familyNameSeen.set(base, dupN + 1);
    const familyName = dupN === 0 ? base : `${base} ${dupN + 1}`;
    const ranked = [...members].sort((a, b) => (confById.get(b) ?? 0) - (confById.get(a) ?? 0) || a.localeCompare(b));
    return { family_name: familyName, concern_count: members.length, primary_concern_ids: ranked.slice(0, 10), all: ranked };
  }).sort((a, b) => b.concern_count - a.concern_count);

  // recommended_group for each similarity pair = the family name shared by its members.
  const familyOfConcern = new Map<string, string>();
  for (const f of families) for (const id of f.all) familyOfConcern.set(id, f.family_name);

  // ── CSV exports (always, even on dry-run) ─────────────────────────────────
  writeCsv('normalized_concern_ontology.csv',
    ['concern_id', 'concern_name', 'canonical_type', 'canonical_entity', 'confidence_score', 'reasoning'],
    ontology.map((o) => [o.concern_id, o.concern_name, o.canonical_type, o.canonical_entity, o.confidence_score, o.reasoning]));
  writeCsv('capability_problem_map.csv',
    ['capability_concern_id', 'capability_name', 'problem_concern_id', 'problem_name', 'confidence_score', 'mapping_reason'],
    capProblem.map((m) => [m.capability_concern_id, m.capability_name, m.problem_concern_id, m.problem_name, m.confidence_score, m.mapping_reason]));
  writeCsv('construct_similarity_map.csv',
    ['concern_a', 'concern_b', 'similarity_score', 'recommended_group'],
    dupPairs.map((p) => [p.a, p.b, p.score, familyOfConcern.get(p.a) ?? familyOfConcern.get(p.b) ?? '']));
  writeCsv('concern_families.csv',
    ['family_name', 'concern_count', 'primary_concern_ids'],
    families.map((f) => [f.family_name, f.concern_count, f.primary_concern_ids.join('|')]));

  // ── Persist (replace mode), unless dry-run ────────────────────────────────
  // The TRUNCATE + all 4 table inserts run inside ONE transaction so a mid-run
  // failure can never leave the extension tables half-refreshed.
  if (!DRY_RUN) {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE normalized_concern_ontology, capability_problem_map, construct_similarity_map, concern_families RESTART IDENTITY');

      await chunkedInsert(client, (chunk) => {
        const vals: unknown[] = [];
        const ph = chunk.map((row, i) => {
          const b = i * 6;
          vals.push(...row);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
        }).join(',');
        return { text: `INSERT INTO normalized_concern_ontology (concern_id,concern_name,canonical_type,canonical_entity,confidence_score,reasoning) VALUES ${ph}`, values: vals };
      }, ontology.map((o) => [o.concern_id, o.concern_name, o.canonical_type, o.canonical_entity, o.confidence_score, o.reasoning]));

      if (capProblem.length) await chunkedInsert(client, (chunk) => {
        const vals: unknown[] = [];
        const ph = chunk.map((row, i) => {
          const b = i * 6; vals.push(...row);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
        }).join(',');
        return { text: `INSERT INTO capability_problem_map (capability_concern_id,capability_name,problem_concern_id,problem_name,confidence_score,mapping_reason) VALUES ${ph} ON CONFLICT (capability_concern_id,problem_concern_id) DO NOTHING`, values: vals };
      }, capProblem.map((m) => [m.capability_concern_id, m.capability_name, m.problem_concern_id, m.problem_name, m.confidence_score, m.mapping_reason]));

      if (dupPairs.length) await chunkedInsert(client, (chunk) => {
        const vals: unknown[] = [];
        const ph = chunk.map((row, i) => {
          const b = i * 4; vals.push(...row);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4})`;
        }).join(',');
        return { text: `INSERT INTO construct_similarity_map (concern_a,concern_b,similarity_score,recommended_group) VALUES ${ph} ON CONFLICT (concern_a,concern_b) DO NOTHING`, values: vals };
      }, dupPairs.map((p) => [p.a, p.b, p.score, familyOfConcern.get(p.a) ?? familyOfConcern.get(p.b) ?? null]));

      if (families.length) await chunkedInsert(client, (chunk) => {
        const vals: unknown[] = [];
        const ph = chunk.map((row, i) => {
          const b = i * 3; vals.push(...row);
          return `($${b + 1},$${b + 2},$${b + 3}::jsonb)`;
        }).join(',');
        return { text: `INSERT INTO concern_families (family_name,concern_count,primary_concern_ids) VALUES ${ph} ON CONFLICT (family_name) DO NOTHING`, values: vals };
      }, families.map((f) => [f.family_name, f.concern_count, JSON.stringify(f.primary_concern_ids)]));

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── 1.5F — audit report ───────────────────────────────────────────────────
  const total = ontology.length;
  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}=== PHASE 1.5F — ONTOLOGY AUDIT ===`);
  console.log('\n## Concern Type Distribution');
  for (const t of ['Capability', 'Problem', 'Behavior', 'Trait', 'Outcome', 'Risk'] as CanonicalType[]) {
    console.log(`  ${t.padEnd(12)} ${String(typeCounts[t]).padStart(5)}  ${pct(typeCounts[t], total)}`);
  }
  console.log('\n## Capability–Problem Pairs');
  console.log(`  Capability constructs: ${typeCounts.Capability}`);
  console.log(`  Problem constructs:    ${typeCounts.Problem}`);
  console.log(`  Mapped cap↔problem pairs: ${capProblem.length}`);
  console.log('\n## Duplicate Constructs');
  const dupConcerns = new Set<string>();
  for (const p of dupPairs) { dupConcerns.add(p.a); dupConcerns.add(p.b); }
  console.log(`  Near-duplicate pairs (Jaccard ≥ ${DUP_THRESHOLD}): ${dupPairs.length} (${dupConcerns.size} concerns)`);
  console.log('\n## Concern Families (top 20 by size)');
  for (const f of families.slice(0, 20)) console.log(`  ${String(f.concern_count).padStart(3)}  ${f.family_name}`);
  console.log(`  ... ${families.length} families total (size ≥ 2; Jaccard ≥ ${FAMILY_THRESHOLD})`);
  console.log('\n## Confidence Distribution');
  const bands: Record<string, number> = { 'weak (≤0.55)': 0, 'moderate (0.56–0.80)': 0, 'strong (>0.80)': 0 };
  for (const o of ontology) {
    if (o.confidence_score <= 0.55) bands['weak (≤0.55)']++;
    else if (o.confidence_score <= 0.80) bands['moderate (0.56–0.80)']++;
    else bands['strong (>0.80)']++;
  }
  for (const [b, n] of Object.entries(bands)) console.log(`  ${b.padEnd(22)} ${String(n).padStart(5)}  ${pct(n, total)}`);

  // Phase-1 vs Phase-1.5 drift (how the normalization moved Problem→Capability).
  const { rows: prior } = await pool.query<{ classification: string; concern_id: string }>(
    `SELECT concern_id, classification FROM concern_classification`,
  ).catch(() => ({ rows: [] as { classification: string; concern_id: string }[] }));
  if (prior.length) {
    const priorMap = new Map(prior.map((p) => [p.concern_id, p.classification]));
    let probToCap = 0, anyFlip = 0;
    for (const o of ontology) {
      const was = priorMap.get(o.concern_id);
      if (was && was !== o.canonical_type) { anyFlip++; if (was === 'Problem' && o.canonical_type === 'Capability') probToCap++; }
    }
    console.log('\n## Phase-1 → Phase-1.5 reclassification drift');
    console.log(`  total type flips: ${anyFlip}  (Problem→Capability: ${probToCap})`);
  }

  console.log(`\nCSV artifacts → ${OUT_DIR}`);
  console.log(DRY_RUN ? '[DRY-RUN] no DB writes performed.\n' : '[WRITE] persisted to 4 Phase-1.5 extension tables.\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
