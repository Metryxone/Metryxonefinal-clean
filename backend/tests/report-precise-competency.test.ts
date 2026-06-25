/**
 * Task #142 — Report Factory precise-competency honesty / flag-gate guards.
 *
 * Task #135 made the candidate's downloadable report append a `precise_competency`
 * section, but ONLY when the `competencyRuntime` flag is ON, ONLY for a competency
 * report with a resolvable subject, and ONLY with MEASURED data (no fabricated
 * zeros; falls back to the domain-proxy when precise scores are absent). These
 * invariants were previously unverified, so a future change could silently break
 * byte-identical-OFF behaviour or start fabricating scores. This regression guard
 * locks them in:
 *
 *   1. Flag OFF  → generateReport for a competency report appends NO
 *      `precise_competency` section AND never even reads the `users` table
 *      (byte-identical to legacy, regardless of measured data being available).
 *   2. Flag ON + measured subject → the section is appended with precise + domain
 *      entries labelled `precise` / `domain_proxy`; a competency whose score is
 *      null is EXCLUDED (never coerced to a fabricated 0).
 *   3. Flag ON + precise absent but domains present → falls back to a domain-only
 *      section with the honest "no precise scores yet" note.
 *   4. Flag ON + no measured data at all → NO section (stays byte-identical for an
 *      unscored user — never an empty fabricated block).
 *   5. Flag ON but a non-competency report → NO section (the gate is per type).
 *   6. The PDF and CSV renderers emit the section — including null scores — without
 *      throwing, labelling precise vs domain_proxy rows in the CSV.
 *
 * The flag is toggled per-scenario via FF_COMPETENCY_RUNTIME; isFlagEnabled reads
 * process.env fresh on every call, so no module re-import is needed. A stub pool
 * keeps the test off any real database — it answers each query generateReport /
 * resolveUnifiedCompetencyProfile issue by matching the SQL text, and records
 * which queries ran so the OFF path can be proven to skip the subject lookup.
 *
 * Run with:  npx tsx backend/tests/report-precise-competency.test.ts
 */

import assert from 'node:assert/strict';

import { generateReport } from '../services/report-factory-schema';
import { renderReportToCSV, renderReportToPDF } from '../services/pdf-renderer';

// ── Minimal test runner (matches the repo's other tsx test files) ─────────────
let passed = 0;
let failed = 0;
function test(label: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓  ${label}`);
      passed++;
    })
    .catch((err: any) => {
      console.error(`  ✗  ${label}`);
      console.error(`     ${err?.message ?? err}`);
      failed++;
    });
}

// ── Stub pool ─────────────────────────────────────────────────────────────────
// Answers the queries generateReport + resolveUnifiedCompetencyProfile issue by
// matching the (whitespace-normalised) SQL text. Records every SQL fragment run
// so a test can assert the OFF path never touches the `users` table. The INSERT
// echoes back the generated_content it was handed (parsed) as the returned row,
// exactly as the real RETURNING * would surface it to the renderers.
interface StubOpts {
  reportType?: string;
  sections?: Record<string, any>[];
  /** undefined → a default subject row; null → no users row; object → that row. */
  user?: Record<string, any> | null;
  runTablePresent?: boolean;
  runRow?: Record<string, any> | null;
  profileTablePresent?: boolean;
  profileRow?: Record<string, any> | null;
}

function makePool(opts: StubOpts = {}) {
  const queries: string[] = [];
  const pool = {
    async query(sql: string, params?: any[]) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      queries.push(s);

      if (s.includes('FROM rf_templates')) {
        return { rows: [{ id: params?.[0], report_type: opts.reportType ?? 'competency', is_active: true }] };
      }
      if (s.includes('FROM rf_template_sections')) {
        return { rows: opts.sections ?? [] };
      }
      if (s.includes('SELECT email, username FROM users')) {
        if (opts.user === null) return { rows: [] };
        return { rows: [opts.user ?? { email: 'subject@example.com', username: 'subject@example.com' }] };
      }
      if (s.includes('to_regclass')) {
        const name = params?.[0];
        if (name === 'onto_competency_score_runs') {
          return { rows: [{ reg: (opts.runTablePresent ?? true) ? name : null }] };
        }
        if (name === 'onto_competency_profiles') {
          return { rows: [{ reg: (opts.profileTablePresent ?? true) ? name : null }] };
        }
        return { rows: [{ reg: null }] };
      }
      if (s.includes('FROM onto_competency_score_runs')) {
        return { rows: opts.runRow ? [opts.runRow] : [] };
      }
      if (s.includes('FROM onto_competency_profiles')) {
        return { rows: opts.profileRow ? [opts.profileRow] : [] };
      }
      if (s.startsWith('INSERT INTO rf_generated_reports')) {
        return {
          rows: [
            {
              id: 1,
              report_uuid: 'test-uuid-142',
              report_type: params?.[3],
              data_snapshot: params?.[4],
              generated_content: JSON.parse(String(params?.[5] ?? '{}')),
              status: 'complete',
              completed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      // UPDATE rf_insight_rules fire_count etc. — no-op.
      return { rows: [] };
    },
    queries,
  };
  return pool as any;
}

function sectionsOf(report: any): Record<string, any>[] {
  return (report?.generated_content?.sections as Record<string, any>[]) ?? [];
}
function preciseSection(report: any): Record<string, any> | undefined {
  return sectionsOf(report).find((s) => s.type === 'precise_competency');
}

// Fixtures ────────────────────────────────────────────────────────────────────
// A measured normalized-run ledger row: one real competency, one null-scored one
// (which MUST be dropped, not coerced to 0), plus a measured domain.
const measuredRunRow = {
  id: 'run-1',
  created_at: new Date().toISOString(),
  overall: { overall_score: 70, overall_level: 3 },
  competency_scores: [
    { competency_id: 'comp_communication', competency_name: 'Communication', normalized_score: 72, level: 3, level_label: 'Proficient', level_status: 'met' },
    { competency_id: 'comp_unscored', competency_name: 'Unscored Comp', normalized_score: null, level: null, level_label: null, level_status: null },
  ],
  normalization: { method: 'minmax' },
  status: 'complete',
  source: 'assessment',
};
const measuredProfileRow = {
  id: 'prof-1',
  created_at: new Date().toISOString(),
  overall_score: 64,
  overall_level: 2,
  profile: [{ onto_domain: 'dom_behavioral', label: 'Behavioral', scaled_score: 55, level: 2 }],
  coverage: { measured: 1 },
  role_id: null,
};

async function run() {
  // ── 1. Flag OFF → byte-identical, no precise section, no users lookup ────────
  await test('flag OFF: competency report appends NO precise_competency section', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'false';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, {
      templateId: 1,
      data: {},
      userId: 'user-1',
    });
    assert.equal(preciseSection(report), undefined, 'no precise_competency section when flag OFF');
  });

  await test('flag OFF: the subject (users) table is never queried', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'false';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const touchedUsers = pool.queries.some((q: string) => q.includes('SELECT email, username FROM users'));
    assert.equal(touchedUsers, false, 'flag-OFF path must not read users (byte-identical to legacy)');
  });

  await test('flag OFF: output is byte-identical to the no-subject legacy path', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'false';
    const sections = [{ section_key: 'intro', section_type: 'narrative', title: 'Intro', config: {} }];
    const withUser = await generateReport(makePool({ sections, runRow: measuredRunRow, profileRow: measuredProfileRow }), {
      templateId: 1, data: {}, userId: 'user-1',
    });
    const noUser = await generateReport(makePool({ sections, runRow: measuredRunRow, profileRow: measuredProfileRow }), {
      templateId: 1, data: {},
    });
    // Compare the FULL generated_content (not just the sections subset) so metadata
    // drift around the additive section would also be caught.
    assert.deepEqual(
      withUser.generated_content,
      noUser.generated_content,
      'flag-OFF generated_content identical with/without a subject',
    );
  });

  // ── 2. Flag ON + measured subject → labelled precise + domain, null dropped ──
  await test('flag ON + measured: section has precise + domain entries, correctly labelled', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const sec = preciseSection(report);
    assert.ok(sec, 'precise_competency section appended when flag ON with measured data');
    assert.equal(sec!.hasPrecise, true);
    assert.ok(Array.isArray(sec!.precise) && sec!.precise.length > 0, 'precise entries present');
    assert.ok(sec!.precise.every((c: any) => c.measurement === 'precise'), 'all precise entries labelled precise');
    assert.ok(Array.isArray(sec!.domains) && sec!.domains.length > 0, 'domain entries present');
    assert.ok(sec!.domains.every((c: any) => c.measurement === 'domain_proxy'), 'all domain entries labelled domain_proxy');
  });

  await test('flag ON + measured: null-scored competency is dropped, never coerced to 0', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const sec = preciseSection(report)!;
    const unscored = sec.precise.find((c: any) => c.code === 'comp_unscored');
    assert.equal(unscored, undefined, 'null-scored competency must NOT appear (no fabricated 0)');
    assert.ok(sec.precise.every((c: any) => c.score !== 0), 'no precise entry carries a fabricated 0 score');
    const measured = sec.precise.find((c: any) => c.code === 'comp_communication');
    assert.equal(measured?.score, 72, 'measured competency keeps its real score');
  });

  // ── 3. Flag ON + precise absent but domains present → domain-only fallback ───
  await test('flag ON + no precise but domains present → falls back to domain-only', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: null, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const sec = preciseSection(report);
    assert.ok(sec, 'section still appended when only domain proxy is measurable');
    assert.equal(sec!.hasPrecise, false);
    assert.equal(sec!.precise.length, 0, 'no precise entries when precise ledger empty');
    assert.ok(sec!.domains.length > 0, 'domain entries present in fallback');
    assert.match(String(sec!.note), /domain-level \(proxy\)/i, 'note explains the domain-proxy fallback');
  });

  // ── 4. Flag ON + nothing measured → byte-identical (no empty fabricated block)
  await test('flag ON + nothing measured → NO section (byte-identical for unscored user)', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: null, profileRow: null });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    assert.equal(preciseSection(report), undefined, 'no section when there is no measured data at all');
  });

  await test('flag ON + ledger tables absent (degraded) → NO section, never throws', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runTablePresent: false, profileTablePresent: false });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    assert.equal(preciseSection(report), undefined, 'degraded substrate fabricates no section');
  });

  await test('flag ON + no subject resolvable → NO section', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ user: null, runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    assert.equal(preciseSection(report), undefined, 'no users row → no subject → no section');
  });

  // ── 5. Per-type gate: non-competency report never gets the section ───────────
  await test('flag ON + non-competency report type → NO precise section', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ reportType: 'career', runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    assert.equal(preciseSection(report), undefined, 'precise section is gated to competency reports only');
  });

  // ── 6. Renderers emit the section (incl. null scores) without throwing ───────
  await test('CSV renderer emits precise_competency + domain_proxy rows without throwing', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const csv = renderReportToCSV(report);
    assert.match(csv, /precise_competency/, 'CSV includes a precise_competency content_type row');
    assert.match(csv, /domain_proxy/, 'CSV includes a domain_proxy content_type row');
    assert.match(csv, /Communication/, 'CSV includes the measured competency name');
  });

  await test('PDF renderer writes the report with a precise section without throwing', async () => {
    process.env.FF_COMPETENCY_RUNTIME = 'true';
    const pool = makePool({ runRow: measuredRunRow, profileRow: measuredProfileRow });
    const report = await generateReport(pool, { templateId: 1, data: {}, userId: 'user-1' });
    const filePath = await renderReportToPDF(report);
    assert.ok(typeof filePath === 'string' && filePath.endsWith('.pdf'), 'PDF render returns a file path');
  });

  await test('renderers tolerate a null-score / empty precise section (no fabricated 0, no throw)', async () => {
    // Synthetic section carrying a null score + an empty precise list to prove the
    // renderers print "—" rather than 0 and never throw on the honest-empty shape.
    const report = {
      report_uuid: 'synthetic-142',
      report_type: 'competency',
      generated_content: {
        sections: [
          {
            key: 'precise_competency',
            type: 'precise_competency',
            title: 'Precise Competency Scores',
            hasPrecise: false,
            precise: [{ code: 'comp_x', name: 'X', score: null, level: null, levelLabel: null, measurement: 'precise' }],
            domains: [{ code: 'dom_y', name: 'Y', score: null, level: null, measurement: 'domain_proxy' }],
            note: 'No precise per-competency scores yet — domain-level (proxy) scores apply.',
          },
        ],
      },
    };
    const csv = renderReportToCSV(report);
    // Parse the precise_competency row's columns and assert the user_score field
    // (column index 7) is blank — never a fabricated "0".
    const header = csv.split('\n')[0].replace(/^\uFEFF/, '').split(',');
    const scoreCol = header.indexOf('user_score');
    assert.ok(scoreCol >= 0, 'CSV exposes a user_score column');
    const preciseLine = csv.split('\n').find((l) => l.includes('"precise_competency"'));
    assert.ok(preciseLine, 'CSV has a precise_competency row');
    const cells = (preciseLine!.match(/"((?:[^"]|"")*)"/g) ?? []).map((c) => c.slice(1, -1).replace(/""/g, '"'));
    assert.equal(cells[scoreCol], '', 'null precise score renders as an empty score field, never 0');
    const filePath = await renderReportToPDF(report);
    assert.ok(filePath.endsWith('.pdf'), 'PDF render of a null-score section returns a path without throwing');
  });

  delete process.env.FF_COMPETENCY_RUNTIME;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
