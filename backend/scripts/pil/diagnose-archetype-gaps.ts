/**
 * CAPADEX PIL — Phase 2.1 diagnostic (READ-ONLY).
 *
 * Explains WHY each Phase-2 unmatched concern is unmatched, distinguishing:
 *   • recoverable  — a legitimate construct-token anchor EXISTS in some archetype, but a
 *     behavior-only candidate (0 tokens, +0.3 alignment bonus) won the "best" slot and
 *     suppressed it → the concern was wrongly flagged unmatched (a scoring bug).
 *   • anchorless   — no archetype token matches the concern's match text at all. Either a
 *     genuine vocabulary gap (token frequently recurs across anchorless concerns) or a
 *     genuinely un-archetypable concern (reported, NEVER force-fit).
 *
 * Writes audit/pil_phase2/gap_diagnosis_*.csv + a summary. Touches no live data.
 *
 *   npx tsx backend/scripts/pil/diagnose-archetype-gaps.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARCHETYPES, assignArchetype, buildMatchTokens, effectiveBehavior, scoreArchetype,
  ASSIGN_MIN_SCORE,
} from '../../services/pil/archetype-intelligence-engine.js';
import { loadArchetypeContexts } from '../../services/pil/archetype-data-loader.js';

const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase2');

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, file), body + '\n', 'utf8');
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { contexts } = await loadArchetypeContexts(pool);
    const unmatched = contexts.filter((c) => assignArchetype(c).archetypeKey === null);

    const recoverableRows: unknown[][] = [];
    const anchorlessRows: unknown[][] = [];
    const tokenGap = new Map<string, number>();     // tokens of anchorless concerns
    const recoverByArch = new Map<string, number>();

    for (const ctx of unmatched) {
      const matchTokens = buildMatchTokens(ctx);
      const { dominant } = effectiveBehavior(ctx);
      // best TOKEN-ANCHORED candidate (the slot the bug suppressed)
      let bestTokenKey = '';
      let bestTokenMatches = 0;
      let bestTokenScore = 0;
      const matchedTokensByArch: string[] = [];
      for (const arch of ARCHETYPES) {
        const s = scoreArchetype(matchTokens, dominant, arch);
        if (s.tokenMatches > 0) {
          for (const t of arch.tokens) if (matchTokens.includes(t)) matchedTokensByArch.push(`${arch.key}:${t}`);
        }
        // under the FIX, a no-token candidate scores 0, so only token-anchored count
        const fixedScore = 0.7 * s.tokenScore; // behavior bonus requires token (see fix)
        if (s.tokenMatches > 0 && (s.tokenMatches > bestTokenMatches ||
            (s.tokenMatches === bestTokenMatches && fixedScore > bestTokenScore))) {
          bestTokenKey = arch.key; bestTokenMatches = s.tokenMatches; bestTokenScore = fixedScore;
        }
      }
      if (bestTokenMatches > 0) {
        // recoverable: a token anchor exists; would it pass the fixed threshold?
        const wouldPass = (0.7 * (bestTokenMatches / (bestTokenMatches + 1.5))) >= ASSIGN_MIN_SCORE;
        recoverableRows.push([
          ctx.concernId, ctx.concernName, ctx.canonicalType, bestTokenKey,
          bestTokenMatches, bestTokenScore.toFixed(4), wouldPass ? 'yes' : 'below_min',
          matchedTokensByArch.join('|'),
        ]);
        if (wouldPass) recoverByArch.set(bestTokenKey, (recoverByArch.get(bestTokenKey) ?? 0) + 1);
      } else {
        anchorlessRows.push([ctx.concernId, ctx.concernName, ctx.canonicalType, matchTokens.join(' ')]);
        for (const t of matchTokens) tokenGap.set(t, (tokenGap.get(t) ?? 0) + 1);
      }
    }

    const topGap = [...tokenGap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);

    writeCsv('gap_diagnosis_recoverable.csv',
      ['concern_id', 'concern_name', 'canonical_type', 'would_assign_to', 'token_matches', 'fixed_score', 'passes_threshold', 'matched_tokens'],
      recoverableRows);
    writeCsv('gap_diagnosis_anchorless.csv',
      ['concern_id', 'concern_name', 'canonical_type', 'match_tokens'],
      anchorlessRows);
    writeCsv('gap_diagnosis_token_gaps.csv',
      ['token', 'anchorless_concern_count'],
      topGap.map(([t, n]) => [t, n]));

    const recoverPass = recoverableRows.filter((r) => r[6] === 'yes').length;
    console.log('\n══════════ PIL 2.1 — GAP DIAGNOSIS ══════════');
    console.log(`Unmatched concerns analysed:        ${unmatched.length}`);
    console.log(`  RECOVERABLE (token anchor exists): ${recoverableRows.length}  (${recoverPass} pass fixed threshold)`);
    console.log(`  ANCHORLESS  (no token at all):     ${anchorlessRows.length}`);
    console.log('\nRecoverable would-assign distribution (passing rows):');
    for (const [k, n] of [...recoverByArch.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
    console.log('\nTop recurring tokens among ANCHORLESS concerns (vocabulary-gap candidates):');
    for (const [t, n] of topGap.slice(0, 30)) console.log(`  ${String(n).padStart(4)}  ${t}`);
    console.log('\nCSVs → audit/pil_phase2/gap_diagnosis_{recoverable,anchorless,token_gaps}.csv');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
