/**
 * Task #383 — Assessment Intelligence (Phase 3.7) — scope-uniqueness regression validator.
 *
 * Run:  cd backend && npx tsx scripts/task383-assessment-intelligence-scope-isolation.ts
 *
 * WHY: the `aint_*` overlay tables store per-candidate, per-assessment records. A code review found the
 * upsert conflict keys originally excluded the scope columns, so two DIFFERENT candidates (or two
 * DIFFERENT assessments) that happened to share the same record `*_key` would silently OVERWRITE each
 * other. The keys are now scoped by `(assessment_slug, subject_ref, *_key)` (and, for benchmarks, `scope`;
 * for norm tables, `(assessment_slug, norm_key, norm_type)`). This validator proves that stays correct.
 *
 * It runs as an ISOLATED flag-ON process (sets `FF_ASSESSMENT_INTELLIGENCE=true` in THIS process only —
 * the shared Backend API workflow keeps the flag OFF, byte-identical) and calls the real save mechanisms.
 * Every row it writes is tagged with a unique per-run prefix so it can only touch its OWN rows; all rows
 * are purged at the end. Honest by construction: assertions compare exact values; the validator is ALLOWED
 * to fail (non-zero exit) — never tune a number to force a pass.
 *
 * For each scope-sensitive table it asserts:
 *   1. Same `*_key`, DIFFERENT scope (subject_ref and/or assessment_slug / norm_type) → BOTH rows persist.
 *   2. Re-save the SAME (scope..., `*_key`) tuple → updates IN PLACE (idempotent recompute), no duplicate.
 */

// Flag ON for THIS process only (env override wins in isFlagEnabled). Set before importing mechanisms.
process.env.FF_ASSESSMENT_INTELLIGENCE = 'true';

import { Pool } from 'pg';
import {
  ensureAintSchema,
  saveStandardScore,
  saveBenchmark,
  saveInterpretation,
  saveReport,
  savePerformance,
  saveNormTable,
} from '../services/assessment-intelligence-mechanisms';

let pass = 0, fail = 0;
const log = (ok: boolean, name: string, extra = '') => {
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const tag = `aint383-${Date.now()}`;
const SL1 = `${tag}-slugA`;
const SL2 = `${tag}-slugB`;
const S1 = `${tag}-subjectA`;
const S2 = `${tag}-subjectB`;
const KEY = `${tag}-key`; // one shared record key reused across scopes on purpose

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureAintSchema(pool);

    // ── aint_standard_scores — key (assessment_slug, subject_ref, score_key) ──────────────────────
    {
      await saveStandardScore(pool, { score_key: KEY, subject_ref: S1, assessment_slug: SL1, raw_value: 11 });
      await saveStandardScore(pool, { score_key: KEY, subject_ref: S2, assessment_slug: SL1, raw_value: 22 }); // diff subject
      await saveStandardScore(pool, { score_key: KEY, subject_ref: S1, assessment_slug: SL2, raw_value: 33 }); // diff slug
      const r = await pool.query(
        `SELECT subject_ref, assessment_slug, raw_value FROM aint_standard_scores WHERE score_key=$1 ORDER BY subject_ref, assessment_slug`, [KEY]);
      log(r.rows.length === 3, 'standard_scores: 3 distinct scoped rows persist (no overwrite)', `got ${r.rows.length}`);
      const s1sl1 = r.rows.find((x) => x.subject_ref === S1 && x.assessment_slug === SL1);
      const s2sl1 = r.rows.find((x) => x.subject_ref === S2 && x.assessment_slug === SL1);
      log(Number(s1sl1?.raw_value) === 11 && Number(s2sl1?.raw_value) === 22,
        'standard_scores: each candidate keeps its OWN value', `A=${s1sl1?.raw_value} B=${s2sl1?.raw_value}`);
      // Idempotent recompute of the SAME tuple → in-place update, no duplicate.
      await saveStandardScore(pool, { score_key: KEY, subject_ref: S1, assessment_slug: SL1, raw_value: 99 });
      const r2 = await pool.query(`SELECT raw_value FROM aint_standard_scores WHERE score_key=$1 AND subject_ref=$2 AND assessment_slug=$3`, [KEY, S1, SL1]);
      log(r2.rows.length === 1 && Number(r2.rows[0].raw_value) === 99,
        'standard_scores: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.raw_value}`);
    }

    // ── aint_benchmarks — key (assessment_slug, subject_ref, benchmark_key, scope) ────────────────
    {
      await saveBenchmark(pool, { benchmark_key: KEY, subject_ref: S1, assessment_slug: SL1, scope: 'peer_cohort', value: 11 });
      await saveBenchmark(pool, { benchmark_key: KEY, subject_ref: S2, assessment_slug: SL1, scope: 'peer_cohort', value: 22 }); // diff subject
      await saveBenchmark(pool, { benchmark_key: KEY, subject_ref: S1, assessment_slug: SL1, scope: 'role_group', value: 33 });  // diff scope
      const r = await pool.query(`SELECT subject_ref, scope, value FROM aint_benchmarks WHERE benchmark_key=$1`, [KEY]);
      log(r.rows.length === 3, 'benchmarks: 3 distinct scoped rows persist (subject + scope segregated)', `got ${r.rows.length}`);
      await saveBenchmark(pool, { benchmark_key: KEY, subject_ref: S1, assessment_slug: SL1, scope: 'peer_cohort', value: 99 });
      const r2 = await pool.query(`SELECT value FROM aint_benchmarks WHERE benchmark_key=$1 AND subject_ref=$2 AND assessment_slug=$3 AND scope=$4`, [KEY, S1, SL1, 'peer_cohort']);
      log(r2.rows.length === 1 && Number(r2.rows[0].value) === 99,
        'benchmarks: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.value}`);
    }

    // ── aint_interpretations — key (assessment_slug, subject_ref, interp_key) ─────────────────────
    {
      await saveInterpretation(pool, { interp_key: KEY, subject_ref: S1, assessment_slug: SL1, narrative: 'A' });
      await saveInterpretation(pool, { interp_key: KEY, subject_ref: S2, assessment_slug: SL1, narrative: 'B' }); // diff subject
      await saveInterpretation(pool, { interp_key: KEY, subject_ref: S1, assessment_slug: SL2, narrative: 'C' }); // diff slug
      const r = await pool.query(`SELECT subject_ref, assessment_slug, narrative FROM aint_interpretations WHERE interp_key=$1`, [KEY]);
      log(r.rows.length === 3, 'interpretations: 3 distinct scoped rows persist (no overwrite)', `got ${r.rows.length}`);
      const a = r.rows.find((x) => x.subject_ref === S1 && x.assessment_slug === SL1);
      const b = r.rows.find((x) => x.subject_ref === S2 && x.assessment_slug === SL1);
      log(a?.narrative === 'A' && b?.narrative === 'B', 'interpretations: each candidate keeps its OWN narrative', `A=${a?.narrative} B=${b?.narrative}`);
      await saveInterpretation(pool, { interp_key: KEY, subject_ref: S1, assessment_slug: SL1, narrative: 'A2' });
      const r2 = await pool.query(`SELECT narrative FROM aint_interpretations WHERE interp_key=$1 AND subject_ref=$2 AND assessment_slug=$3`, [KEY, S1, SL1]);
      log(r2.rows.length === 1 && r2.rows[0].narrative === 'A2',
        'interpretations: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.narrative}`);
    }

    // ── aint_reports — key (assessment_slug, subject_ref, report_key) ─────────────────────────────
    {
      await saveReport(pool, { report_key: KEY, subject_ref: S1, assessment_slug: SL1, section_count: 1 });
      await saveReport(pool, { report_key: KEY, subject_ref: S2, assessment_slug: SL1, section_count: 2 }); // diff subject
      await saveReport(pool, { report_key: KEY, subject_ref: S1, assessment_slug: SL2, section_count: 3 }); // diff slug
      const r = await pool.query(`SELECT subject_ref, assessment_slug, section_count FROM aint_reports WHERE report_key=$1`, [KEY]);
      log(r.rows.length === 3, 'reports: 3 distinct scoped rows persist (no overwrite)', `got ${r.rows.length}`);
      await saveReport(pool, { report_key: KEY, subject_ref: S1, assessment_slug: SL1, section_count: 9 });
      const r2 = await pool.query(`SELECT section_count FROM aint_reports WHERE report_key=$1 AND subject_ref=$2 AND assessment_slug=$3`, [KEY, S1, SL1]);
      log(r2.rows.length === 1 && Number(r2.rows[0].section_count) === 9,
        'reports: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.section_count}`);
    }

    // ── aint_performance — key (assessment_slug, subject_ref, perf_key) ───────────────────────────
    {
      await savePerformance(pool, { perf_key: KEY, subject_ref: S1, assessment_slug: SL1, overall_score: 11 });
      await savePerformance(pool, { perf_key: KEY, subject_ref: S2, assessment_slug: SL1, overall_score: 22 }); // diff subject
      await savePerformance(pool, { perf_key: KEY, subject_ref: S1, assessment_slug: SL2, overall_score: 33 }); // diff slug
      const r = await pool.query(`SELECT subject_ref, assessment_slug, overall_score FROM aint_performance WHERE perf_key=$1`, [KEY]);
      log(r.rows.length === 3, 'performance: 3 distinct scoped rows persist (no overwrite)', `got ${r.rows.length}`);
      await savePerformance(pool, { perf_key: KEY, subject_ref: S1, assessment_slug: SL1, overall_score: 99 });
      const r2 = await pool.query(`SELECT overall_score FROM aint_performance WHERE perf_key=$1 AND subject_ref=$2 AND assessment_slug=$3`, [KEY, S1, SL1]);
      log(r2.rows.length === 1 && Number(r2.rows[0].overall_score) === 99,
        'performance: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.overall_score}`);
    }

    // ── aint_norm_tables — key (assessment_slug, norm_key, norm_type) (no subject_ref) ────────────
    {
      const NK = `${tag}-normkey`;
      await saveNormTable(pool, { norm_key: NK, assessment_slug: SL1, norm_type: 'cohort_norm', reference_mean: 11 });
      await saveNormTable(pool, { norm_key: NK, assessment_slug: SL2, norm_type: 'cohort_norm', reference_mean: 22 }); // diff slug
      await saveNormTable(pool, { norm_key: NK, assessment_slug: SL1, norm_type: 'role_norm', reference_mean: 33 });   // diff type
      const r = await pool.query(`SELECT assessment_slug, norm_type, reference_mean FROM aint_norm_tables WHERE norm_key=$1`, [NK]);
      log(r.rows.length === 3, 'norm_tables: 3 distinct scoped rows persist (assessment + type segregated)', `got ${r.rows.length}`);
      await saveNormTable(pool, { norm_key: NK, assessment_slug: SL1, norm_type: 'cohort_norm', reference_mean: 99 });
      const r2 = await pool.query(`SELECT reference_mean FROM aint_norm_tables WHERE norm_key=$1 AND assessment_slug=$2 AND norm_type=$3`, [NK, SL1, 'cohort_norm']);
      log(r2.rows.length === 1 && Number(r2.rows[0].reference_mean) === 99,
        'norm_tables: re-save same tuple updates in place (idempotent)', `rows=${r2.rows.length} val=${r2.rows[0]?.reference_mean}`);
    }
  } catch (e) {
    log(false, 'validator threw', (e as Error).message);
  } finally {
    // Purge only this run's rows (targeted by the unique tag across every scope column).
    for (const t of ['aint_standard_scores', 'aint_benchmarks', 'aint_interpretations', 'aint_reports', 'aint_performance']) {
      await pool.query(`DELETE FROM ${t} WHERE assessment_slug LIKE $1 OR subject_ref LIKE $1`, [`${tag}%`]).catch(() => {});
    }
    await pool.query(`DELETE FROM aint_norm_tables WHERE assessment_slug LIKE $1 OR norm_key LIKE $1`, [`${tag}%`]).catch(() => {});
    // Confirm cleanup left no residue.
    let residue = 0;
    for (const t of ['aint_standard_scores', 'aint_benchmarks', 'aint_interpretations', 'aint_reports', 'aint_performance', 'aint_norm_tables']) {
      const key = t === 'aint_norm_tables' ? 'norm_key' : 'subject_ref';
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE assessment_slug LIKE $1 OR ${key} LIKE $1`, [`${tag}%`]).catch(() => ({ rows: [{ n: -1 }] }));
      residue += Number(c.rows[0].n) || 0;
    }
    log(residue === 0, 'cleanup: no test rows remain', `residue=${residue}`);
    await pool.end();
  }

  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail === 0 ? 0 : 1);
})();
