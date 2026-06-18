#!/usr/bin/env node
/**
 * Phase-3 proxy-language remediation — deterministic stem cleanup.
 *
 * Re-detects the EXACT proxy-language issue set the Phase-1 audit reported
 * (`backend/scripts/audit/question-intelligence-audit.mjs`, the proxyReasons
 * block) directly over the live `capadex_clarity_questions` table, proposes a
 * deterministic content rewrite ONLY for genuine content defects, and classifies
 * every flagged row into auto-approve / review-required / manual-review.
 *
 * Design rules (quality > coverage):
 *   • first-person fragments ("…feel I cannot focus")  → rewrite to canonical
 *     self-report second person via the same normalizeSelfReport() the runtime
 *     engine uses. This is a real content defect — it breaks BOTH the learner
 *     reading and the proxy reframe.
 *   • dangling reflexives ("calm yourself")            → NO content change. These
 *     are natural self-report; the proxy reframe is handled at runtime by
 *     proxy-language-engine.rephraseForProxy(). Recorded as a confirmed no-op.
 *   • no 2nd-person anchor (abstract "how does X …")   → NOT auto-rewritten;
 *     injecting a "you" reliably needs human authoring. Left blank for
 *     manual review. We never fabricate an anchor.
 *
 * DRY-RUN by default: writes the review artifact to audit/phase3/ and touches
 * NOTHING in the database or source CSV.
 *
 *   npx tsx backend/scripts/audit/proxy-language-cleanup.mjs              # dry-run
 *   npx tsx backend/scripts/audit/proxy-language-cleanup.mjs --apply      # apply auto-approve
 *   npx tsx backend/scripts/audit/proxy-language-cleanup.mjs --apply --include-review
 *
 * (Runs under tsx because it imports the .ts runtime engine for a single source
 *  of truth on normalizeSelfReport — node alone cannot load the .ts import.)
 *
 * --apply updates the DB (UPDATE … WHERE id) inside one transaction AND rewrites
 * the matching `question` cells in audited_clarity_questions.csv. Idempotent: a
 * second run finds the rewritten rows already clean. manual-review is NEVER
 * auto-applied.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
import { normalizeSelfReport } from '../../services/proxy-language-engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'audit', 'phase3');
const SOURCE_CSV = path.join(REPO_ROOT, 'audited_clarity_questions.csv');

const APPLY = process.argv.includes('--apply');
const INCLUDE_REVIEW = process.argv.includes('--include-review');

// ── audit detector (verbatim predicates from question-intelligence-audit.mjs) ──
function detectProxyReasons(text) {
  const reasons = [];
  const has2nd = /\b(you|your|yours|yourself)\b/i.test(text);
  const has1st = /\b(i|my|me|mine|myself|we|our)\b/i.test(text);
  if (has1st) reasons.push('first-person pronoun (breaks proxy/learner reframe)');
  if (!has2nd) reasons.push('no 2nd-person pronoun (nothing to reframe to 3rd person)');
  if (
    /\b(do|are|have|were|was)\s+you\s+\w+ing\b/i.test(text) === false &&
    /\byou\b/i.test(text) &&
    /\b(yourself)\b/i.test(text)
  ) {
    reasons.push('reflexive "yourself" — proxy reframe leaves dangling reflexive');
  }
  return { reasons, has2nd, has1st };
}

const round = (n) => Math.round(n * 1000) / 1000;

// ── context where a first-person token must NOT be blindly flipped to 2nd person ──
// The first-person here is quoted / attributed inner self-talk, or sits under an
// explicit third-person subject ("the child feel I …"). Flipping "I"→"you" inside
// these produces unnatural quoted second-person ("feel \"you are not good enough\"" —
// odd in self mode, broken in proxy: "feel \"Abhi are not good enough\"") or a
// grammatically broken stem ("the child feel you cannot focus"). The original
// first-person-in-quotes is in fact CORRECT for self mode (it is the user's own
// inner-speech); reframing quoted self-talk for proxy/learner is a genuine authoring
// problem, never a mechanical pronoun flip. Routed to human authoring. (quality > coverage)
//
// NOTE on quote bytes: this dataset wraps inner-speech in Windows-1252 smart quotes
// stored as the C1 control code points U+0093/U+0094 (and U+0092 for the apostrophe),
// NOT ASCII/Unicode quotes — so the quote class MUST include \u0091-\u0094 or the
// guard silently misses ~all real quoted self-talk.
const QUOTED_SELF_TALK_MARK = /["'\u2018\u2019\u201C\u201D\u0091\u0092\u0093\u0094]/;
export function isAttributedOrThirdPersonSelfTalk(text) {
  if (QUOTED_SELF_TALK_MARK.test(text)) return true; // literal-quoted self-talk (any encoding)
  if (/\bthoughts?\b/i.test(text)) return true; // attributed-thought ("thoughts like/about X")
  if (/\bwhat if\b/i.test(text)) return true; // hypothetical inner-worry ("what if I fail")
  if (/\b(the|their|his|her|a)\s+(child|student|kid|son|daughter|teen|teenager|learner)\b/i.test(text)) {
    return true; // explicit third-person human subject in the stem
  }
  return false;
}

// ── per-row remediation decision ──────────────────────────────────────────────
export function planRewrite(text) {
  const { reasons, has2nd, has1st } = detectProxyReasons(text);
  if (!reasons.length) return null; // not flagged

  // 0) first-person that is quoted / attributed / under a 3rd-person subject →
  //    never auto-flip; defer to human authoring.
  if (has1st && isAttributedOrThirdPersonSelfTalk(text)) {
    return {
      reasons: reasons.join('; '),
      original: text,
      rewritten: '',
      rule: 'quoted_or_attributed_self_talk_needs_authoring',
      confidence: 0.2,
      classification: 'manual-review',
    };
  }

  // 1) first-person fragment → normalise to second person (genuine content fix)
  if (has1st) {
    const rewritten = normalizeSelfReport(text);
    const afterHas1st = /\b(i|my|me|mine|myself|we|our)\b/i.test(rewritten);
    const afterHas2nd = /\b(you|your|yours|yourself)\b/i.test(rewritten);
    let confidence = 0.9;
    let rule = 'first_person_to_second';
    let classification;
    if (rewritten === text) {
      // normalize made no change (e.g. a lone lowercase "i") → cannot safely fix
      return {
        reasons: reasons.join('; '),
        original: text,
        rewritten: '',
        rule: 'first_person_unresolved',
        confidence: 0.2,
        classification: 'manual-review',
      };
    }
    if (afterHas1st) confidence -= 0.4; // residual first-person → needs eyes
    if (!afterHas2nd) confidence -= 0.15;
    // light grammar guard: a broken 3rd-person conjugation residue is suspicious
    if (/\b(does|is|was|has)\s+\w+\s+(feels|likes|wants|finds|seems|knows|gets|makes)\b/i.test(rewritten)) {
      confidence -= 0.2;
    }
    confidence = round(Math.max(0, Math.min(1, confidence)));
    classification = confidence >= 0.85 ? 'auto-approve' : confidence >= 0.6 ? 'review-required' : 'manual-review';
    return { reasons: reasons.join('; '), original: text, rewritten, rule, confidence, classification };
  }

  // 2) dangling reflexive only (has 2nd person, no 1st person) → engine handles
  //    the proxy reframe at runtime. No content change is correct.
  if (has2nd && reasons.some((r) => r.startsWith('reflexive'))) {
    return {
      reasons: reasons.join('; '),
      original: text,
      rewritten: text, // confirmed no-op
      rule: 'no_change_engine_handles_reflexive',
      confidence: 0.95,
      classification: 'auto-approve',
    };
  }

  // 3) no 2nd-person anchor and no 1st-person → abstract stem. We never fabricate
  //    a "you"; this needs human authoring.
  return {
    reasons: reasons.join('; '),
    original: text,
    rewritten: '',
    rule: 'missing_anchor_needs_authoring',
    confidence: 0.2,
    classification: 'manual-review',
  };
}

// ── minimal RFC-4180 CSV writer (csv-stringify not installed) ─────────────────
function csvCell(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function writeCsv(file, headers, rows) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = [headers.join(',')];
  for (const r of rows) out.push(headers.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(path.join(OUT_DIR, file), out.join('\n'));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    'SELECT id, question_id, concern, master_bridge_tag, question FROM capadex_clarity_questions',
  );

  const proposals = [];
  for (const r of rows) {
    const plan = planRewrite(String(r.question ?? ''));
    if (!plan) continue;
    proposals.push({
      id: r.id,
      question_id: r.question_id,
      concern: r.concern,
      master_bridge_tag: r.master_bridge_tag,
      ...plan,
    });
  }

  const byClass = { 'auto-approve': 0, 'review-required': 0, 'manual-review': 0 };
  const byRule = {};
  for (const p of proposals) {
    byClass[p.classification] = (byClass[p.classification] || 0) + 1;
    byRule[p.rule] = (byRule[p.rule] || 0) + 1;
  }
  // a "changing" auto-approve actually alters text; no-op reflexives don't.
  const changing = proposals.filter(
    (p) => p.rewritten && p.rewritten !== p.original &&
      (p.classification === 'auto-approve' || (INCLUDE_REVIEW && p.classification === 'review-required')),
  );

  // ── DRY-RUN artifacts ──
  writeCsv(
    'proxy_cleanup_proposed.csv',
    ['id', 'question_id', 'concern', 'master_bridge_tag', 'reasons', 'original', 'rewritten', 'rule', 'confidence', 'classification'],
    proposals,
  );
  const summary = {
    generated_at: new Date().toISOString(),
    total_flagged: proposals.length,
    by_classification: byClass,
    by_rule: byRule,
    changing_rewrites_in_scope: changing.length,
    apply_mode: APPLY,
    include_review: INCLUDE_REVIEW,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'proxy_cleanup_summary.json'), JSON.stringify(summary, null, 2));

  console.log('── Phase-3 proxy-language remediation (dry-run artifact written) ──');
  console.log(`  total flagged          : ${proposals.length}`);
  console.log(`  auto-approve           : ${byClass['auto-approve']}`);
  console.log(`  review-required        : ${byClass['review-required']}`);
  console.log(`  manual-review          : ${byClass['manual-review']}`);
  console.log('  by rule:');
  for (const [k, v] of Object.entries(byRule)) console.log(`    ${k.padEnd(34)} ${v}`);
  console.log(`  changing rewrites in apply scope: ${changing.length}`);
  console.log(`  artifact: audit/phase3/proxy_cleanup_proposed.csv`);

  if (!APPLY) {
    console.log('\nDRY-RUN only — no DB or CSV changes. Re-run with --apply after review.');
    await pool.end();
    return;
  }

  // ── APPLY (guarded; manual-review never applied) ──
  if (!changing.length) {
    console.log('\nNothing to apply.');
    await pool.end();
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of changing) {
      await client.query('UPDATE capadex_clarity_questions SET question = $1 WHERE id = $2', [p.rewritten, p.id]);
    }
    await client.query('COMMIT');
    console.log(`\nDB updated: ${changing.length} rows.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('DB update rolled back:', e);
    client.release();
    await pool.end();
    process.exit(1);
  }
  client.release();

  // mirror into the source CSV (match by question_id)
  if (fs.existsSync(SOURCE_CSV)) {
    const raw = fs.readFileSync(SOURCE_CSV, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
    const changeByQid = new Map(changing.map((p) => [String(p.question_id), p.rewritten]));
    let csvChanged = 0;
    for (const rec of records) {
      const nv = changeByQid.get(String(rec.question_id));
      if (nv !== undefined && rec.question !== nv) {
        rec.question = nv;
        csvChanged++;
      }
    }
    const headers = Object.keys(records[0] ?? {});
    const lines = [headers.join(',')];
    for (const rec of records) lines.push(headers.map((h) => csvCell(rec[h])).join(','));
    fs.writeFileSync(SOURCE_CSV, lines.join('\n'));
    console.log(`Source CSV updated: ${csvChanged} rows (audited_clarity_questions.csv).`);
  } else {
    console.warn('Source CSV not found — skipped CSV mirror.');
  }

  await pool.end();
}

// Only run the DB-touching pipeline when executed directly (not on import-for-test).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
