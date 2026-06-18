/**
 * CAPADEX PIL — Phase 1 runner: classify every concern in
 * `capadex_concerns_master` and populate `concern_classification`.
 *
 * EXTENSION-ONLY — reads the concern master, writes ONLY the new table. Reuses
 * the pure engine (`services/pil/concern-classification-engine.ts`) so the
 * script and any future route can never drift. Idempotent.
 *
 * Run:
 *   npx tsx backend/scripts/pil/run-concern-classification.ts             # replace (default)
 *   npx tsx backend/scripts/pil/run-concern-classification.ts --mode=upsert
 *   npx tsx backend/scripts/pil/run-concern-classification.ts --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  classifyConcern,
  summarize,
  CLASSIFICATIONS,
  type ConcernRow,
  type ClassificationResult,
} from '../../services/pil/concern-classification-engine';

const DDL = `
CREATE TABLE IF NOT EXISTS concern_classification (
  id               SERIAL PRIMARY KEY,
  concern_id       TEXT NOT NULL,
  concern_name     TEXT NOT NULL,
  classification   TEXT NOT NULL
    CHECK (classification IN ('Capability','Problem','Behavior','Trait','Outcome','Risk')),
  confidence_score NUMERIC(5,4) NOT NULL
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning        TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS concern_classification_concern_id_key
  ON concern_classification (concern_id);
CREATE INDEX IF NOT EXISTS concern_classification_classification_idx
  ON concern_classification (classification);
`;

const CSV_OUT = path.resolve('exports/pil_phase1_concern_classification.csv');
const CHUNK = 200;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');

  const modeRaw = (arg('mode') || 'replace').toLowerCase();
  const mode: 'replace' | 'upsert' = modeRaw === 'upsert' ? 'upsert' : 'replace';
  const dryRun = process.argv.includes('--dry-run');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.log(`[pil:classify] mode=${mode} dryRun=${dryRun} — loading concerns …`);

    const { rows } = await pool.query<ConcernRow>(
      `SELECT concern_id, display_label, concern_cluster, concern_category, domain, root_cause_group
         FROM capadex_concerns_master
        ORDER BY concern_id`,
    );
    console.log(`[pil:classify] loaded ${rows.length} concerns`);

    const results: ClassificationResult[] = rows.map(classifyConcern);

    if (!dryRun) {
      await pool.query(DDL);
      if (mode === 'replace') {
        await pool.query('TRUNCATE concern_classification RESTART IDENTITY');
      }
      for (let i = 0; i < results.length; i += CHUNK) {
        const slice = results.slice(i, i + CHUNK);
        const values: string[] = [];
        const params: unknown[] = [];
        slice.forEach((r, j) => {
          const b = j * 5;
          values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
          params.push(r.concern_id, r.concern_name, r.classification, r.confidence_score, r.reasoning);
        });
        const conflict =
          mode === 'upsert'
            ? `ON CONFLICT (concern_id) DO UPDATE SET
                 concern_name = EXCLUDED.concern_name,
                 classification = EXCLUDED.classification,
                 confidence_score = EXCLUDED.confidence_score,
                 reasoning = EXCLUDED.reasoning,
                 created_at = now()`
            : 'ON CONFLICT (concern_id) DO NOTHING';
        await pool.query(
          `INSERT INTO concern_classification
             (concern_id, concern_name, classification, confidence_score, reasoning)
           VALUES ${values.join(', ')} ${conflict}`,
          params,
        );
      }
      console.log(`[pil:classify] wrote ${results.length} rows to concern_classification`);
    } else {
      console.log('[pil:classify] dry-run — no rows written');
    }

    // Human-review CSV.
    fs.mkdirSync(path.dirname(CSV_OUT), { recursive: true });
    const header = ['concern_id', 'concern_name', 'classification', 'confidence_score', 'reasoning', 'domain', 'concern_category'];
    const byId = new Map(rows.map((r) => [r.concern_id, r]));
    const lines = [header.join(',')];
    for (const r of results) {
      const src = byId.get(r.concern_id);
      lines.push(
        [r.concern_id, r.concern_name, r.classification, r.confidence_score, r.reasoning, src?.domain ?? '', src?.concern_category ?? '']
          .map(csvCell)
          .join(','),
      );
    }
    fs.writeFileSync(CSV_OUT, lines.join('\n'));
    console.log(`[pil:classify] wrote review CSV → ${CSV_OUT}`);

    // Summary table.
    const counts = summarize(results);
    const total = results.length;
    const avgConf =
      results.reduce((s, r) => s + r.confidence_score, 0) / Math.max(1, total);
    const lowConf = results.filter((r) => r.confidence_score < 0.6).length;

    console.log('\n=== PHASE 1 — CLASSIFICATION SUMMARY ===');
    console.log('Type         Count    %');
    for (const c of CLASSIFICATIONS) {
      const n = counts[c];
      const pct = ((n / Math.max(1, total)) * 100).toFixed(1);
      console.log(`${c.padEnd(12)} ${String(n).padStart(5)}  ${pct.padStart(5)}%`);
    }
    console.log(`${'TOTAL'.padEnd(12)} ${String(total).padStart(5)}`);
    console.log(`\nAvg confidence: ${avgConf.toFixed(4)}`);
    console.log(`Low-confidence rows (<0.60): ${lowConf}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[pil:classify] FAILED:', err);
  process.exit(1);
});
