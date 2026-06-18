// RRP-1 REPORTS — (a) synonym candidate/priority groups derived from ontology
// evidence (co-occurrence inside bridge tags / clusters — NO LLM), and
// (b) missing-construct audit for the 6 marketed constructs (exists-as-concern /
// bridge-only / missing — NO concern creation).
// Run: npx tsx scripts/audit/rrp1-reports.ts
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeIntent, RESOLVER_SYNONYM_GROUPS, RESOLVER_STOPWORDS } from '../../services/concern-resolver-engine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(ROOT, 'audit/rrp1');

const CONSTRUCTS = [
  { name: 'CAREER_CLARITY', words: ['career', 'clarity', 'clear', 'direction', 'goal'] },
  { name: 'CAREER_STABILITY', words: ['career', 'stability', 'stable', 'security', 'secure'] },
  { name: 'LEADERSHIP', words: ['leadership', 'leader', 'lead', 'manage', 'ownership'] },
  { name: 'COMMUNICATION', words: ['communication', 'communicate', 'express', 'speaking', 'conversation'] },
  { name: 'ENTREPRENEURSHIP', words: ['entrepreneur', 'entrepreneurship', 'startup', 'business', 'venture'] },
  { name: 'FUTURE_READINESS', words: ['future', 'readiness', 'ready', 'prepared', 'adaptability'] },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: databaseUrl });
  fs.mkdirSync(OUT, { recursive: true });

  const rs = await pool.query(
    `SELECT concern_id, display_label, concern_cluster, relational_bridge_tag, domain
       FROM capadex_concerns_master`,
  );
  const rows = rs.rows as any[];

  // ---------- (a) SYNONYM CANDIDATE GROUPS (co-occurrence in a bridge tag) ----------
  // Tokens that recur across multiple concerns of the SAME bridge tag are
  // candidate group members anchored on that tag (real ontology evidence).
  const existingSyn = new Set<string>();
  for (const g of RESOLVER_SYNONYM_GROUPS) for (const t of g) existingSyn.add(t);

  const byTag = new Map<string, Map<string, number>>(); // tag -> token -> concernCount
  for (const r of rows) {
    const tag = r.relational_bridge_tag || '';
    if (!tag) continue;
    const toks = new Set(tokenizeIntent(`${r.display_label || ''} ${r.concern_cluster || ''}`));
    if (!byTag.has(tag)) byTag.set(tag, new Map());
    const m = byTag.get(tag)!;
    for (const t of toks) m.set(t, (m.get(t) || 0) + 1);
  }

  const candidates: { tag: string; tokens: string[]; coverage: number; novel: number }[] = [];
  for (const [tag, m] of byTag) {
    const recurring = [...m.entries()]
      .filter(([t, c]) => c >= 2 && t.length >= 3 && !RESOLVER_STOPWORDS.has(t))
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
    if (recurring.length >= 2) {
      const novel = recurring.filter((t) => !existingSyn.has(t)).length;
      candidates.push({ tag, tokens: recurring.slice(0, 8), coverage: recurring.length, novel });
    }
  }
  candidates.sort((a, b) => b.coverage - a.coverage);

  // priority = candidate groups whose anchor tokens appear in still-unresolved intents
  let stillTokens = new Map<string, number>();
  const stillPath = path.join(OUT, 'still_unresolved.csv');
  if (fs.existsSync(stillPath)) {
    const lines = fs.readFileSync(stillPath, 'utf8').split('\n').slice(1);
    for (const ln of lines) {
      const m = ln.match(/^"([^"]*)"/);
      if (!m) continue;
      for (const t of tokenizeIntent(m[1])) stillTokens.set(t, (stillTokens.get(t) || 0) + 1);
    }
  }
  const priority = candidates
    .map((c) => ({ ...c, leverage: c.tokens.reduce((s, t) => s + (stillTokens.get(t) || 0), 0) }))
    .filter((c) => c.leverage > 0)
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, 40);

  const candCsv = ['bridge_tag,recurring_token_count,novel_vs_existing,candidate_tokens'];
  for (const c of candidates.slice(0, 200)) candCsv.push(`${c.tag},${c.coverage},${c.novel},"${c.tokens.join(' | ')}"`);
  fs.writeFileSync(path.join(OUT, 'synonym_candidate_groups.csv'), candCsv.join('\n'));

  const priCsv = ['bridge_tag,leverage_in_unresolved,candidate_tokens'];
  for (const c of priority) priCsv.push(`${c.tag},${c.leverage},"${c.tokens.join(' | ')}"`);
  fs.writeFileSync(path.join(OUT, 'synonym_priority_groups.csv'), priCsv.join('\n'));

  // ---------- (b) MISSING-CONSTRUCT AUDIT ----------
  const constructReport: any[] = [];
  for (const c of CONSTRUCTS) {
    const tagRows = rows.filter((r) => (r.relational_bridge_tag || '') === c.name);
    // semantic match: concern whose label/cluster contains the construct's words
    const semanticRows = rows.filter((r) => {
      const hay = `${r.display_label || ''} ${r.concern_cluster || ''}`.toLowerCase();
      return c.words.some((w) => hay.includes(w));
    });
    let status: string;
    if (tagRows.length > 0) status = 'exists_as_concern';
    else if (semanticRows.length > 0) status = 'bridge_only'; // concept present semantically but no dedicated bridge tag
    else status = 'missing';
    constructReport.push({
      construct: c.name,
      status,
      exact_tag_concerns: tagRows.length,
      semantic_concerns: semanticRows.length,
      sample_semantic: semanticRows.slice(0, 3).map((r) => ({ id: r.concern_id, label: r.display_label, tag: r.relational_bridge_tag })),
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    note: 'Investigation only — NO concerns or bridge tags were created or modified.',
    synonym: {
      existing_groups: RESOLVER_SYNONYM_GROUPS.length,
      existing_tokens: existingSyn.size,
      candidate_groups: candidates.length,
      priority_groups: priority.length,
    },
    missing_constructs: constructReport,
  };
  fs.writeFileSync(path.join(OUT, 'reports_summary.json'), JSON.stringify(report, null, 2));

  console.log('synonym candidates:', candidates.length, '| priority (touch unresolved):', priority.length);
  for (const c of constructReport) console.log(`  ${c.construct.padEnd(18)} ${c.status.padEnd(18)} tag=${c.exact_tag_concerns} semantic=${c.semantic_concerns}`);
  console.log('wrote', OUT);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
