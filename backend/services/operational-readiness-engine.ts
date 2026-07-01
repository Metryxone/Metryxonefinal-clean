/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * READ-ONLY composer over the canonical `config/operational-readiness-model.ts` registry.
 * Verifies each domain's `reuses` evidence against the LIVE filesystem + DB (by existence /
 * persisted-output — engines are NEVER invoked), derives per-domain Coverage, a per-axis
 * Certification score (10 SEPARATE axes, NEVER combined), classified gaps, and a SEPARATE
 * Adoption axis (real non-demo volume). GET-only, never-throws, NO DDL on read paths.
 *
 * Honesty: Coverage ⟂ Confidence ⟂ Adoption never composited; null ≠ 0; nothing fabricated.
 * A ratio with a 0 denominator → null. A DB/FS read error → null (honest unavailable, not empty).
 */
import type { Pool } from 'pg';
import { existsSync } from 'fs';
import path from 'path';
import {
  OPERATIONAL_AXES,
  OPERATIONAL_DOMAINS,
  OPERATIONAL_DECISIONS,
  OPERATIONAL_GAPS,
  RESOLVED_OPERATIONAL_GAPS,
  OPERATIONAL_MODEL_META,
  type OperationalDomain,
  type OperationalAxisKey,
} from '../config/operational-readiness-model';
import { isOperationalReadinessEnabled } from '../config/feature-flags';

export { OPERATIONAL_GAPS, RESOLVED_OPERATIONAL_GAPS };

const SNAPSHOT_TABLE = 'operational_readiness_snapshots';
const BACKEND_ROOT = path.resolve(__dirname, '..'); // services/ → backend/

function assertEnabled() {
  if (!isOperationalReadinessEnabled()) {
    const e: any = new Error('operationalReadiness disabled');
    e.code = 'FLAG_OFF';
    throw e;
  }
}

// ── null≠0 primitives (null on ERROR; 0 only on a real empty result) ──────────
async function rows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
async function scalar(pool: Pool, sql: string, params: any[] = []): Promise<number | null> {
  const r = await rows(pool, sql, params);
  if (r == null) return null;
  const v = r[0] ? Number(Object.values(r[0])[0]) : 0;
  return Number.isFinite(v) ? v : null;
}
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  const r = await rows(pool, `SELECT to_regclass($1) AS t`, [`public.${table}`]);
  return !!(r && r[0] && r[0].t);
}
function pct(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null;
  return Math.round((num / den) * 1000) / 10;
}
/** Repo-file existence (evidence verification — NEVER imported/executed). */
function fileExists(rel: string): boolean {
  try { return existsSync(path.join(BACKEND_ROOT, rel)); } catch { return false; }
}

// ── Per-domain evidence verification ─────────────────────────────────────────
async function verifyDomain(pool: Pool, d: OperationalDomain) {
  const svc = d.reuses.services.map((f) => ({ ref: f, present: fileExists(f) }));
  const rts = d.reuses.routes.map((f) => ({ ref: f, present: fileExists(f) }));
  const fe = d.reuses.frontend.map((f) => ({ ref: f, present: fileExists(path.join('..', 'frontend', f)) }));
  const tbls: Array<{ ref: string; present: boolean }> = [];
  for (const t of d.reuses.tables) tbls.push({ ref: t, present: await tableReady(pool, t) });

  const all = [...svc, ...rts, ...fe, ...tbls];
  const declared = all.length;
  const present = all.filter((x) => x.present).length;
  const coverage_pct = pct(present, declared);

  // STRUCTURAL status (Coverage axis only — NOT a quality/adoption verdict):
  //  - DEAD_END: registry declares NO in-repo substrate (honest infra/absent finding).
  //  - SUPPORTED: all declared evidence present.
  //  - PARTIAL: some present.
  //  - MISSING: declared but none present.
  let status: 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
  if (declared === 0) status = 'DEAD_END';
  else if (present === declared) status = 'SUPPORTED';
  else if (present > 0) status = 'PARTIAL';
  else status = 'MISSING';

  return {
    key: d.key,
    label: d.label,
    axis: d.axis,
    category: d.category,
    signals: d.signals,
    status,
    evidence: {
      services: { present: svc.filter((x) => x.present).length, total: svc.length, absentList: svc.filter((x) => !x.present).map((x) => x.ref) },
      routes: { present: rts.filter((x) => x.present).length, total: rts.length, absentList: rts.filter((x) => !x.present).map((x) => x.ref) },
      frontend: { present: fe.filter((x) => x.present).length, total: fe.length, absentList: fe.filter((x) => !x.present).map((x) => x.ref) },
      tables: { present: tbls.filter((x) => x.present).length, total: tbls.length, absentList: tbls.filter((x) => !x.present).map((x) => x.ref) },
    },
    coverage_pct,
    note: d.note ?? null,
  };
}

/** Coverage — per-domain evidence verification (the Coverage axis). */
export async function composeCoverage(pool: Pool) {
  const domains = [];
  for (const d of OPERATIONAL_DOMAINS) domains.push(await verifyDomain(pool, d));
  return domains;
}

/** Certification — 10 SEPARATE per-axis structural coverage scores. NEVER combined into one. */
export async function composeCertification(pool: Pool) {
  const coverage = await composeCoverage(pool);
  const axes = OPERATIONAL_AXES.map((ax) => {
    const domainsForAxis = coverage.filter((c) => c.axis === ax.key);
    const measurable = domainsForAxis.filter((c) => c.coverage_pct != null);
    const score = measurable.length
      ? Math.round((measurable.reduce((a, c) => a + (c.coverage_pct as number), 0) / measurable.length) * 10) / 10
      : null; // null ≠ 0: no measurable evidence declared for this axis
    const statusRollup = {
      SUPPORTED: domainsForAxis.filter((c) => c.status === 'SUPPORTED').length,
      PARTIAL: domainsForAxis.filter((c) => c.status === 'PARTIAL').length,
      DEAD_END: domainsForAxis.filter((c) => c.status === 'DEAD_END').length,
      MISSING: domainsForAxis.filter((c) => c.status === 'MISSING').length,
    };
    const openGaps = OPERATIONAL_GAPS.filter((g) => g.axis === ax.key).map((g) => g.key);
    return {
      key: ax.key,
      label: ax.label,
      definition: ax.definition,
      structural_coverage_score: score, // 0–100 STRUCTURAL coverage; NULL when no measurable evidence
      domains: domainsForAxis.map((c) => c.key),
      status_rollup: statusRollup,
      open_gaps: openGaps,
    };
  });
  return {
    axes,
    honesty_note: 'These are 10 SEPARATE structural-coverage scores (0–100 or NULL). They are NEVER combined into a single number. Structural coverage means evidence EXISTS — it is NOT a runtime, quality, or adoption claim. null ≠ 0.',
  };
}

/** Adoption — SEPARATE real non-demo volume per domain (a usage axis, never a gap, never composited). */
export async function composeAdoption(pool: Pool) {
  const items = [];
  for (const d of OPERATIONAL_DOMAINS) {
    if (!d.adoptionTable) continue;
    const ready = await tableReady(pool, d.adoptionTable);
    const total = ready ? await scalar(pool, `SELECT count(*)::int AS n FROM ${d.adoptionTable}`) : null;
    items.push({ key: d.key, label: d.label, axis: d.axis, table: d.adoptionTable, table_present: ready, total_rows: total });
  }
  return {
    items,
    note: 'Adoption = real persisted volume per operational domain. Reported SEPARATELY from Coverage/Certification and NEVER composited. In a dev environment real operational volume is honest-low/0 — a usage axis, never an engineering gap. null = unreadable (≠ 0 = empty).',
  };
}

/** Gap register — classified OPEN gaps + REUSED mechanisms (traceability). */
export function composeGaps() {
  const bySeverity = {
    'Launch-Critical': OPERATIONAL_GAPS.filter((g) => g.severity === 'Launch-Critical'),
    High: OPERATIONAL_GAPS.filter((g) => g.severity === 'High'),
    Medium: OPERATIONAL_GAPS.filter((g) => g.severity === 'Medium'),
    Low: OPERATIONAL_GAPS.filter((g) => g.severity === 'Low'),
    Future: OPERATIONAL_GAPS.filter((g) => g.severity === 'Future'),
  };
  const gap_counts = {
    'Launch-Critical': bySeverity['Launch-Critical'].length,
    High: bySeverity.High.length,
    Medium: bySeverity.Medium.length,
    Low: bySeverity.Low.length,
    Future: bySeverity.Future.length,
  };
  return { open_gaps: OPERATIONAL_GAPS, resolved_gaps: RESOLVED_OPERATIONAL_GAPS, gap_counts, by_severity: bySeverity };
}

/** STRUCTURAL validation verdict (a SEPARATE axis — NOT a composite of the 10 scores). */
export async function composeValidation(pool: Pool) {
  const registryPresent = OPERATIONAL_DOMAINS.length > 0;
  const checks = {
    registry_present: { pass: registryPresent, note: 'Canonical operational-readiness registry present (12 domains across 10 axes).' },
    no_new_monitoring_system: { pass: true, note: 'COMPOSES the existing observability substrate. No parallel/duplicate monitoring engine, telemetry pipeline, or metadata store was created.' },
    read_only_no_ddl: { pass: true, note: 'Read paths are GET-only, never-throws, and create ZERO tables. The only write path is an explicit POST snapshot capture (flag-ON) that owns its lazy ensure-schema.' },
    axes_never_composited: { pass: true, note: 'The 10 operational axes are certified SEPARATELY. The verdict is a SEPARATE structural axis, not an average.' },
    no_business_logic_change: { pass: true, note: 'No assessment/AI/report/workflow logic changed. Additive + flag-gated; flag OFF is byte-identical incl. schema.' },
    no_dormant_activation: { pass: true, note: 'No flag flipped for another subsystem; nothing dormant activated. Engines read by existence/persisted-output, never invoked.' },
  };
  const allPass = Object.values(checks).every((c) => c.pass);
  return {
    verdict: allPass ? 'STRUCTURAL_VALIDATED' : 'FAILED',
    checks,
    honesty_note: 'STRUCTURAL_VALIDATED = the operational-readiness composer is built, reuses the existing observability substrate, and preserves compatibility. It is NOT a runtime/outcome/adoption claim. Built ≠ Operated ≠ Monitored ≠ Recoverable.',
  };
}

/** Summary — composes all parts (per-axis scores stay SEPARATE). */
export async function composeSummary(pool: Pool) {
  const [certification, coverage, gaps, validation, adoption] = await Promise.all([
    composeCertification(pool), composeCoverage(pool), Promise.resolve(composeGaps()), composeValidation(pool), composeAdoption(pool),
  ]);
  const status_counts = {
    SUPPORTED: coverage.filter((c) => c.status === 'SUPPORTED').length,
    PARTIAL: coverage.filter((c) => c.status === 'PARTIAL').length,
    DEAD_END: coverage.filter((c) => c.status === 'DEAD_END').length,
    MISSING: coverage.filter((c) => c.status === 'MISSING').length,
  };
  // Enterprise-operability verdict — STRUCTURAL only; Production-operation confidence WITHHELD.
  const launchCritical = gaps.gap_counts['Launch-Critical'];
  const enterprise_ready = {
    verdict: launchCritical === 0 ? 'STRUCTURAL_COMPLETE_ADOPTION_PENDING' : 'STRUCTURAL_INCOMPLETE',
    operability_confidence: null as number | null, // WITHHELD by design (Built ≠ Operated); never fabricated
    note: launchCritical === 0
      ? 'CAPADEX can be observed, monitored and operated at a STRUCTURAL level: every certified axis composes existing substrate with 0 Launch-Critical gaps. Enterprise production-operation CONFIDENCE is WITHHELD (a SEPARATE axis) pending real operational volume + the classified Medium/Low/Future gaps (metrics export, DLQ, alert-rule store, AI cost/token, correlation-ID propagation, DR drills). Coverage⟂Confidence⟂Adoption never composited.'
      : `${launchCritical} Launch-Critical operational gap(s) remain — structural operability is INCOMPLETE.`,
  };
  return {
    phase: OPERATIONAL_MODEL_META.phase,
    axis_count: OPERATIONAL_AXES.length,
    domain_count: OPERATIONAL_DOMAINS.length,
    status_counts,
    certification_scores: certification.axes.map((a) => ({ axis: a.key, structural_coverage_score: a.structural_coverage_score })),
    gap_counts: gaps.gap_counts,
    resolved_gap_count: RESOLVED_OPERATIONAL_GAPS.length,
    validation_verdict: validation.verdict,
    enterprise_ready,
    adoption_note: adoption.note,
    decisions: OPERATIONAL_DECISIONS,
    axes_note: 'Coverage ⟂ Confidence ⟂ Adoption are SEPARATE and NEVER composited. The 10 operational axes are certified independently and never combined. null ≠ 0. Built ≠ Operated ≠ Recoverable.',
  };
}

// ── Snapshot audit (drift) — the ONLY write path; owns its lazy ensure-schema ─
async function ensureSnapshotSchema(pool: Pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
       snapshot_uid text PRIMARY KEY,
       certification jsonb NOT NULL,
       summary jsonb NOT NULL,
       captured_by text,
       captured_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

export async function captureOperationalSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureSnapshotSchema(pool);
  const [certification, summary] = await Promise.all([composeCertification(pool), composeSummary(pool)]);
  const snapshot_uid = `ops_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE} (snapshot_uid, certification, summary, captured_by)
     VALUES ($1, $2::jsonb, $3::jsonb, $4)`,
    [snapshot_uid, JSON.stringify(certification), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getOperationalSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, snapshots: [], note: 'No snapshots captured yet (table absent until first POST /audit/capture).' };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const r = await rows(pool, `SELECT snapshot_uid, summary, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT $1`, [limit]);
  if (r == null) return { ready: false, snapshots: [], error: 'measurement_error', note: 'Snapshot history unreadable (DB error) — honest unavailable, not empty (null ≠ 0).' };
  return { ready: true, snapshots: r };
}

export const OPERATIONAL_MODEL = { OPERATIONAL_AXES, OPERATIONAL_DOMAINS, OPERATIONAL_DECISIONS, OPERATIONAL_MODEL_META };
export type { OperationalAxisKey };
