/**
 * Question Registry Service — CAPADEX Phase 5 (long-term maintainability, 2026-06-01).
 *
 * Lifecycle-tracks every clarity question so the bank can scale to 20,000+ items
 * under HUMAN governance. Responsibilities:
 *
 *   • ensureQuestionRegistrySchema — lazy DDL (mirrors 20260601_question_registry.sql).
 *   • refreshRegistry              — bulk, set-based metric snapshot + backfill.
 *                                    Computes usage / signal / report-impact /
 *                                    quality / nearest-duplicate. NEVER changes
 *                                    a row's lifecycle status.
 *   • buildGovernanceData          — read-only governance buckets + stats from
 *                                    the snapshot (weak / duplicate / low-signal /
 *                                    retirement candidates).
 *   • getRegistryPage              — server-side paginated registry (20k-safe).
 *   • transitionStatus             — the ONLY status writer. Human-driven; audited.
 *
 * Honesty contract: signal_value / report_impact are NULL when no traceable
 * evidence exists — absence is never collapsed into a fabricated neutral score,
 * so a question that was simply never measured is distinguishable from one
 * measured to be low-signal.
 *
 * Scale contract: metrics are snapshotted by refresh (not recomputed per
 * request); governance/stats read indexed columns; duplicate detection is
 * BUCKETED by master_bridge_tag (Σ small n² instead of one global N²).
 */
import type { Pool } from 'pg';
import { jaccard, tokenSet, SEMANTIC_THRESHOLD } from './adaptive/zero-repetition';
import { classifyDimension, type CoverageDimension, type CoverageMethod } from './behavioral-coverage-engine';
import { buildUtilityIndex, type UtilityIndex } from './question-utility-index';

export const LIFECYCLE_STATUSES = [
  'draft',
  'testing',
  'active',
  'candidate_for_retirement',
  'deprecated',
  'archived',
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export function isLifecycleStatus(s: unknown): s is LifecycleStatus {
  return typeof s === 'string' && (LIFECYCLE_STATUSES as readonly string[]).includes(s);
}

// Governance thresholds — surfaced in stats so the UI can show what "weak" means.
export const WEAK_QUALITY_THRESHOLD = 0.45;
export const LOW_SIGNAL_THRESHOLD = 0.30;
// Active statuses that still serve users (governance focuses here).
const SERVING_STATUSES: LifecycleStatus[] = ['draft', 'testing', 'active'];

export interface RegistryRow {
  question_id: string;
  question: string | null;
  master_bridge_tag: string | null;
  version: number;
  status: LifecycleStatus;
  quality_score: number | null;
  quality_overridden: boolean;
  usage_count: number;
  last_used_at: string | null;
  signal_value: number | null;
  report_impact: number | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  metrics_computed_at: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  review_notes: string | null;
  coverage_dimension: CoverageDimension | null;
  coverage_method: CoverageMethod | null;
  coverage_confidence: number | null;
}

export interface RegistryStats {
  generated_at: string;
  total_questions: number;
  registered: number;
  status_counts: Record<LifecycleStatus, number>;
  metrics: {
    measured_usage: number;       // rows with usage_count > 0
    measured_signal: number;      // rows with signal_value IS NOT NULL
    measured_report_impact: number;
    avg_quality: number | null;
    last_refreshed_at: string | null;
  };
  governance: {
    weak: number;
    duplicate: number;
    low_signal: number;
    dead_end: number;
    utility_mapped: boolean;
    human_retirement_candidates: number;
    suggested_for_review: number;
  };
  thresholds: {
    weak_quality: number;
    low_signal: number;
    semantic_duplicate: number;
  };
}

export interface GovernanceItem {
  question_id: string;
  question: string | null;
  master_bridge_tag: string | null;
  status: LifecycleStatus;
  quality_score: number | null;
  usage_count: number;
  signal_value: number | null;
  report_impact: number | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  reasons: string[];
}

export interface GovernanceData {
  generated_at: string;
  stats: RegistryStats;
  weak: GovernanceItem[];
  duplicate: GovernanceItem[];
  low_signal: GovernanceItem[];
  dead_end: GovernanceItem[];
  retirement_candidates: GovernanceItem[];
}

const GOVERNANCE_CAP = 500; // per bucket — UI is a triage surface, not a dump

// ───────────────────────────── Schema ──────────────────────────────────────

export async function ensureQuestionRegistrySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_question_registry (
      question_id        TEXT PRIMARY KEY,
      version            INTEGER       NOT NULL DEFAULT 1,
      status             TEXT          NOT NULL DEFAULT 'active',
      quality_score      NUMERIC(5,4),
      quality_overridden BOOLEAN       NOT NULL DEFAULT FALSE,
      usage_count        INTEGER       NOT NULL DEFAULT 0,
      last_used_at       TIMESTAMPTZ,
      signal_value       NUMERIC(5,4),
      report_impact      NUMERIC(5,4),
      duplicate_of       TEXT,
      duplicate_score    NUMERIC(5,4),
      metrics_computed_at TIMESTAMPTZ,
      status_changed_at  TIMESTAMPTZ,
      status_changed_by  TEXT,
      review_notes       TEXT,
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      CONSTRAINT capadex_question_registry_status_chk CHECK (
        status IN ('draft','testing','active','candidate_for_retirement','deprecated','archived')
      )
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_status    ON capadex_question_registry (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_quality   ON capadex_question_registry (quality_score)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_usage     ON capadex_question_registry (usage_count)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_signal    ON capadex_question_registry (signal_value)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_duplicate ON capadex_question_registry (duplicate_score)`);
  // Behavioural Coverage Engine columns (mirrors 20260602_question_registry_coverage.sql).
  await pool.query(`
    ALTER TABLE capadex_question_registry
      ADD COLUMN IF NOT EXISTS coverage_dimension  TEXT,
      ADD COLUMN IF NOT EXISTS coverage_dimensions JSONB,
      ADD COLUMN IF NOT EXISTS coverage_method     TEXT,
      ADD COLUMN IF NOT EXISTS coverage_confidence NUMERIC(5,4)
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqr_coverage_dim ON capadex_question_registry (coverage_dimension)`);
}

// ─────────────────────── Metric computation (real data) ─────────────────────

interface ClarityRow {
  question_id: string;
  question: string | null;
  master_bridge_tag: string | null;
  option_count: number;
  has_scores: boolean;
  has_response_type: boolean;
  question_type: string | null;
  stage: string | null;
  narrative_style: string | null;
  polarity: string | null;
}

interface UsageRow { question_id: string; usage_count: number; last_used_at: string | null; }
interface EvidenceRow { question_id: string; signal_value: number | null; report_impact: number | null; }
interface DuplicateInfo { duplicate_of: string | null; duplicate_score: number | null; }

/** Usage telemetry from real responses. Cast item_id→text to tolerate the
 *  uuid/text column drift; questions never answered come back simply absent. */
async function loadUsage(pool: Pool): Promise<Map<string, UsageRow>> {
  const out = new Map<string, UsageRow>();
  try {
    const { rows } = await pool.query<{ qid: string; n: string; last: string | null }>(`
      SELECT item_id::text AS qid, COUNT(*)::int AS n, MAX(created_at) AS last
        FROM capadex_responses
       WHERE item_id IS NOT NULL
       GROUP BY item_id::text
    `);
    for (const r of rows) {
      out.set(r.qid, { question_id: r.qid, usage_count: Number(r.n) || 0, last_used_at: r.last });
    }
  } catch {
    // capadex_responses absent / unreadable → no usage telemetry (not fabricated).
  }
  return out;
}

/** Signal value + report impact from the evidence spine. Both NULL when a
 *  question has produced no evidence — never a neutral fabricated score. */
async function loadEvidenceMetrics(pool: Pool): Promise<Map<string, EvidenceRow>> {
  const out = new Map<string, EvidenceRow>();
  try {
    const { rows } = await pool.query<{
      qid: string; sig: string | null; ev_total: string; ev_in_pattern: string;
    }>(`
      WITH pattern_ev AS (
        SELECT DISTINCT jsonb_array_elements_text(evidence_refs) AS eid
          FROM capadex_session_patterns
         WHERE evidence_refs IS NOT NULL
           AND jsonb_typeof(evidence_refs) = 'array'
      )
      SELECT e.source_id AS qid,
             AVG(e.strength * e.confidence)                           AS sig,
             COUNT(*)::int                                            AS ev_total,
             COUNT(*) FILTER (WHERE p.eid IS NOT NULL)::int           AS ev_in_pattern
        FROM capadex_evidence e
        LEFT JOIN pattern_ev p ON p.eid = e.id::text
       WHERE e.source_id IS NOT NULL AND e.source_id <> ''
       GROUP BY e.source_id
    `);
    for (const r of rows) {
      const total = Number(r.ev_total) || 0;
      const inPat = Number(r.ev_in_pattern) || 0;
      out.set(r.qid, {
        question_id: r.qid,
        signal_value: r.sig === null ? null : clamp01(Number(r.sig)),
        report_impact: total > 0 ? clamp01(inPat / total) : null,
      });
    }
  } catch {
    // Evidence / pattern spine absent → leave signal/impact unmeasured (NULL).
  }
  return out;
}

/** Nearest semantic duplicate, computed WITHIN each bridge-tag bucket so the
 *  pass is Σ(small n²) rather than one global N² — safe at 20k+. */
function computeDuplicates(clarity: ClarityRow[]): Map<string, DuplicateInfo> {
  const out = new Map<string, DuplicateInfo>();
  const buckets = new Map<string, ClarityRow[]>();
  for (const c of clarity) {
    const key = (c.master_bridge_tag || '').toUpperCase().trim() || '__UNTAGGED__';
    (buckets.get(key) || buckets.set(key, []).get(key)!).push(c);
  }
  for (const rows of buckets.values()) {
    if (rows.length < 2) {
      for (const r of rows) out.set(r.question_id, { duplicate_of: null, duplicate_score: null });
      continue;
    }
    const tokens = rows.map((r) => tokenSet(r.question || ''));
    for (let i = 0; i < rows.length; i++) {
      let bestScore = 0;
      let bestId: string | null = null;
      for (let j = 0; j < rows.length; j++) {
        if (i === j) continue;
        const s = jaccard(tokens[i], tokens[j]);
        if (s > bestScore) { bestScore = s; bestId = rows[j].question_id; }
      }
      out.set(rows[i].question_id, {
        duplicate_of: bestScore > 0 ? bestId : null,
        duplicate_score: bestScore > 0 ? round4(bestScore) : null,
      });
    }
  }
  return out;
}

/**
 * Composite quality heuristic (0..1), transparent + human-overridable:
 *   structural completeness (≤0.40) — text, ≥2 options, scores, response_type
 *   usage signal           (≤0.30) — log-scaled real usage
 *   distinctness           (≤0.30) — penalised by nearest-duplicate overlap
 * Signal value, when measured, nudges within the usage band so a high-signal
 * question is never scored as weak purely for low volume.
 */
function computeQuality(
  c: ClarityRow,
  usage: number,
  signal: number | null,
  dup: DuplicateInfo,
): number {
  let structural = 0;
  if ((c.question || '').trim().length > 0) structural += 0.1;
  if (c.option_count >= 2) structural += 0.1;
  if (c.has_scores) structural += 0.1;
  if (c.has_response_type) structural += 0.1;

  // Usage: log-scaled, saturates around 50 responses. A measured signal value
  // can stand in for raw volume so genuinely-useful low-volume items aren't weak.
  const usageBand = usage > 0 ? Math.min(0.3, 0.3 * (Math.log1p(usage) / Math.log1p(50))) : 0;
  const signalBand = signal !== null ? 0.3 * signal : 0;
  const evidenceBand = Math.max(usageBand, signalBand);

  const overlap = dup.duplicate_score ?? 0;
  const distinct = 0.3 * (1 - Math.min(1, overlap));

  return round4(clamp01(structural + evidenceBand + distinct));
}

// ───────────────────────────── Refresh ─────────────────────────────────────

export interface RefreshResult {
  generated_at: string;
  total_clarity_questions: number;
  inserted: number;
  updated: number;
  metrics_measured: { usage: number; signal: number; report_impact: number };
}

/**
 * Bulk, idempotent metric snapshot + backfill. Inserts a registry row for any
 * clarity question that lacks one (default status 'active' — these items are
 * already serving) and refreshes metric snapshots for every row. NEVER mutates
 * lifecycle status, and skips quality_score for human-overridden rows.
 */
export async function refreshRegistry(pool: Pool): Promise<RefreshResult> {
  await ensureQuestionRegistrySchema(pool);
  const generatedAt = new Date().toISOString();

  const { rows: clarity } = await pool.query<ClarityRow>(`
    SELECT question_id,
           question,
           master_bridge_tag,
           ( (CASE WHEN COALESCE(option_a,'') <> '' THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(option_b,'') <> '' THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(option_c,'') <> '' THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(option_d,'') <> '' THEN 1 ELSE 0 END)
           + (CASE WHEN COALESCE(option_e,'') <> '' THEN 1 ELSE 0 END) ) AS option_count,
           (COALESCE(option_a_score,0) <> 0 OR COALESCE(option_b_score,0) <> 0) AS has_scores,
           (COALESCE(response_type,'') <> '') AS has_response_type,
           question_type, stage, narrative_style, polarity
      FROM capadex_clarity_questions
     WHERE question_id IS NOT NULL AND TRIM(question_id) <> ''
  `);

  const [usage, evidence] = await Promise.all([loadUsage(pool), loadEvidenceMetrics(pool)]);
  const duplicates = computeDuplicates(clarity);

  let inserted = 0;
  let updated = 0;
  let mUsage = 0, mSignal = 0, mImpact = 0;

  for (const c of clarity) {
    const u = usage.get(c.question_id);
    const ev = evidence.get(c.question_id);
    const dup = duplicates.get(c.question_id) ?? { duplicate_of: null, duplicate_score: null };
    const usageCount = u?.usage_count ?? 0;
    const signal = ev?.signal_value ?? null;
    const impact = ev?.report_impact ?? null;
    const quality = computeQuality(c, usageCount, signal, dup);

    // Behavioural-dimension classification (deterministic snapshot).
    const cov = classifyDimension(c);

    if (usageCount > 0) mUsage++;
    if (signal !== null) mSignal++;
    if (impact !== null) mImpact++;

    // Upsert metrics + coverage ONLY. Status, version, review fields are owned by
    // humans: an existing row keeps its status; quality is preserved when
    // overridden. RETURNING (xmax = 0) is TRUE only for a freshly INSERTed row.
    const res = await pool.query<{ inserted: boolean }>(
      `INSERT INTO capadex_question_registry
         (question_id, status, quality_score, usage_count, last_used_at,
          signal_value, report_impact, duplicate_of, duplicate_score,
          coverage_dimension, coverage_dimensions, coverage_method, coverage_confidence,
          metrics_computed_at, updated_at)
       VALUES ($1,'active',$2,$3,$4,$5,$6,$7,$8,$10,$11,$12,$13,$9,$9)
       ON CONFLICT (question_id) DO UPDATE SET
         usage_count        = EXCLUDED.usage_count,
         last_used_at       = EXCLUDED.last_used_at,
         signal_value       = EXCLUDED.signal_value,
         report_impact      = EXCLUDED.report_impact,
         duplicate_of       = EXCLUDED.duplicate_of,
         duplicate_score    = EXCLUDED.duplicate_score,
         coverage_dimension  = EXCLUDED.coverage_dimension,
         coverage_dimensions = EXCLUDED.coverage_dimensions,
         coverage_method     = EXCLUDED.coverage_method,
         coverage_confidence = EXCLUDED.coverage_confidence,
         quality_score      = CASE WHEN capadex_question_registry.quality_overridden
                                   THEN capadex_question_registry.quality_score
                                   ELSE EXCLUDED.quality_score END,
         metrics_computed_at = EXCLUDED.metrics_computed_at,
         updated_at          = EXCLUDED.updated_at
       RETURNING (xmax = 0) AS inserted`,
      [c.question_id, quality, usageCount, u?.last_used_at ?? null,
       signal, impact, dup.duplicate_of, dup.duplicate_score, generatedAt,
       cov.dimension, JSON.stringify(cov.dimensions), cov.method, cov.confidence],
    );
    if (res.rows[0]?.inserted) inserted++; else updated++;
  }

  return {
    generated_at: generatedAt,
    total_clarity_questions: clarity.length,
    inserted,
    updated,
    metrics_measured: { usage: mUsage, signal: mSignal, report_impact: mImpact },
  };
}

// ─────────────────────── Read: registry page ───────────────────────────────

export interface RegistryPageOpts {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RegistryPage {
  generated_at: string;
  total: number;
  limit: number;
  offset: number;
  rows: RegistryRow[];
}

export async function getRegistryPage(pool: Pool, opts: RegistryPageOpts): Promise<RegistryPage> {
  await ensureQuestionRegistrySchema(pool);
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const where: string[] = [];
  const params: unknown[] = [];
  if (isLifecycleStatus(opts.status)) {
    params.push(opts.status);
    where.push(`r.status = $${params.length}`);
  }
  if (opts.search && opts.search.trim()) {
    params.push(`%${opts.search.trim().toLowerCase()}%`);
    where.push(`(LOWER(r.question_id) LIKE $${params.length} OR LOWER(q.question) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::int AS total
       FROM capadex_question_registry r
       LEFT JOIN capadex_clarity_questions q ON q.question_id = r.question_id
       ${whereSql}`,
    params,
  );
  params.push(limit, offset);
  const { rows } = await pool.query<RegistryRow>(
    `SELECT r.question_id, q.question, q.master_bridge_tag,
            r.version, r.status, r.quality_score, r.quality_overridden,
            r.usage_count, r.last_used_at, r.signal_value, r.report_impact,
            r.duplicate_of, r.duplicate_score, r.metrics_computed_at,
            r.status_changed_at, r.status_changed_by, r.review_notes,
            r.coverage_dimension, r.coverage_method, r.coverage_confidence
       FROM capadex_question_registry r
       LEFT JOIN capadex_clarity_questions q ON q.question_id = r.question_id
       ${whereSql}
       ORDER BY r.quality_score ASC NULLS FIRST, r.usage_count DESC, r.question_id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    generated_at: new Date().toISOString(),
    total: Number(totalRes.rows[0]?.total ?? 0),
    limit,
    offset,
    rows,
  };
}

// ─────────────────────── Read: governance buckets ──────────────────────────

function toItem(r: RegistryRow, reasons: string[]): GovernanceItem {
  return {
    question_id: r.question_id,
    question: r.question,
    master_bridge_tag: r.master_bridge_tag,
    status: r.status,
    quality_score: r.quality_score,
    usage_count: r.usage_count,
    signal_value: r.signal_value,
    report_impact: r.report_impact,
    duplicate_of: r.duplicate_of,
    duplicate_score: r.duplicate_score,
    reasons,
  };
}

export async function buildGovernanceData(pool: Pool): Promise<GovernanceData> {
  await ensureQuestionRegistrySchema(pool);
  const generatedAt = new Date().toISOString();

  const { rows: all } = await pool.query<RegistryRow>(`
    SELECT r.question_id, q.question, q.master_bridge_tag,
           r.version, r.status, r.quality_score, r.quality_overridden,
           r.usage_count, r.last_used_at, r.signal_value, r.report_impact,
           r.duplicate_of, r.duplicate_score, r.metrics_computed_at,
           r.status_changed_at, r.status_changed_by, r.review_notes,
           r.coverage_dimension, r.coverage_method, r.coverage_confidence
      FROM capadex_question_registry r
      LEFT JOIN capadex_clarity_questions q ON q.question_id = r.question_id
  `);

  const statusCounts = emptyStatusCounts();
  let measuredUsage = 0, measuredSignal = 0, measuredImpact = 0;
  let qualitySum = 0, qualityN = 0;
  let lastRefreshed: string | null = null;

  const weak: GovernanceItem[] = [];
  const duplicate: GovernanceItem[] = [];
  const lowSignal: GovernanceItem[] = [];
  const deadEnd: GovernanceItem[] = [];
  const retirement: GovernanceItem[] = [];

  // Downstream-utility index (read-only, reuses the production chain validator).
  // Self-disables when the signal-map has no tier-3 rows → no dead_end flags on
  // absent evidence. Best-effort: a failure here must never break governance.
  let utility: UtilityIndex | null = null;
  try {
    utility = await buildUtilityIndex(pool);
  } catch {
    utility = null;
  }

  // "Never asked" is only a meaningful low-signal signal once the bank is
  // actually collecting responses. Before any assessment has run, every
  // question is unmeasured (not low-signal) — flagging all of them is noise.
  // Gate the unused clause on real system-wide usage existing.
  const systemHasUsage = all.some((r) => r.usage_count > 0);

  for (const r of all) {
    if (isLifecycleStatus(r.status)) statusCounts[r.status]++;
    if (r.usage_count > 0) measuredUsage++;
    if (r.signal_value !== null) measuredSignal++;
    if (r.report_impact !== null) measuredImpact++;
    if (r.quality_score !== null) { qualitySum += Number(r.quality_score); qualityN++; }
    if (r.metrics_computed_at && (!lastRefreshed || r.metrics_computed_at > lastRefreshed)) {
      lastRefreshed = r.metrics_computed_at;
    }

    const serving = isLifecycleStatus(r.status) && SERVING_STATUSES.includes(r.status);

    // weak — low quality among serving questions.
    const isWeak = serving && r.quality_score !== null && Number(r.quality_score) < WEAK_QUALITY_THRESHOLD;
    if (isWeak) weak.push(toItem(r, [`quality ${fmt(r.quality_score)} < ${WEAK_QUALITY_THRESHOLD}`]));

    // duplicate — high semantic overlap with a sibling in the same bridge tag.
    const isDuplicate = r.duplicate_score !== null && Number(r.duplicate_score) >= SEMANTIC_THRESHOLD;
    if (isDuplicate) {
      duplicate.push(toItem(r, [`${fmt(r.duplicate_score)} overlap with ${r.duplicate_of ?? '—'}`]));
    }

    // low-signal — measured low signal value, OR serving-but-never-asked once
    // the bank is actually collecting responses (see systemHasUsage above).
    const measuredLow = r.signal_value !== null && Number(r.signal_value) < LOW_SIGNAL_THRESHOLD;
    const unused = serving && systemHasUsage && r.usage_count === 0;
    const isLowSignal = measuredLow || unused;
    if (isLowSignal) {
      const reasons: string[] = [];
      if (measuredLow) reasons.push(`signal ${fmt(r.signal_value)} < ${LOW_SIGNAL_THRESHOLD}`);
      if (unused) reasons.push('never asked (0 responses)');
      lowSignal.push(toItem(r, reasons));
    }

    // dead-end — the answer travels nowhere: this question's bridge tag is mapped
    // to concern(s) whose intelligence chain never reaches an intervention. Only
    // a DEFINITIVELY mapped-but-incomplete tag counts; unknown/unmapped tags are
    // never flagged (honest — no utility verdict on absent evidence).
    let isDeadEnd = false;
    if (utility?.mapped && r.master_bridge_tag) {
      const tu = utility.byTag.get(r.master_bridge_tag);
      if (tu && tu.status === 'dead_end') {
        isDeadEnd = true;
        deadEnd.push(toItem(r, [
          `downstream chain dead-ends at ${tu.breaks_at ?? 'signal'}`,
          `${tu.concern_count} concern(s) mapped, 0 reach an intervention`,
          '(needs curated signal/intervention authoring — not auto-removed)',
        ]));
      }
    }

    // retirement candidates — human-marked, PLUS algorithmic suggestions that a
    // human must still confirm. Nothing is ever auto-retired.
    if (r.status === 'candidate_for_retirement') {
      retirement.push(toItem(r, ['marked candidate_for_retirement (human review)']));
    } else if (serving && isWeak && (isDuplicate || isLowSignal || isDeadEnd)) {
      const reasons = ['suggested — weak'];
      if (isDuplicate) reasons.push('duplicate');
      if (isLowSignal) reasons.push('low-signal');
      if (isDeadEnd) reasons.push('dead-end');
      reasons.push('(needs human review — not auto-retired)');
      retirement.push(toItem(r, reasons));
    }
  }

  const cmp = (a: GovernanceItem, b: GovernanceItem) =>
    (a.quality_score ?? 1) - (b.quality_score ?? 1) || b.usage_count - a.usage_count;
  weak.sort(cmp); lowSignal.sort(cmp); deadEnd.sort(cmp); retirement.sort(cmp);
  duplicate.sort((a, b) => (b.duplicate_score ?? 0) - (a.duplicate_score ?? 0));

  const humanRetire = retirement.filter((r) => r.status === 'candidate_for_retirement').length;
  const stats: RegistryStats = {
    generated_at: generatedAt,
    total_questions: all.length,
    registered: all.length,
    status_counts: statusCounts,
    metrics: {
      measured_usage: measuredUsage,
      measured_signal: measuredSignal,
      measured_report_impact: measuredImpact,
      avg_quality: qualityN ? round4(qualitySum / qualityN) : null,
      last_refreshed_at: lastRefreshed,
    },
    governance: {
      weak: weak.length,
      duplicate: duplicate.length,
      low_signal: lowSignal.length,
      dead_end: deadEnd.length,
      utility_mapped: utility?.mapped ?? false,
      human_retirement_candidates: humanRetire,
      suggested_for_review: retirement.length - humanRetire,
    },
    thresholds: {
      weak_quality: WEAK_QUALITY_THRESHOLD,
      low_signal: LOW_SIGNAL_THRESHOLD,
      semantic_duplicate: SEMANTIC_THRESHOLD,
    },
  };

  return {
    generated_at: generatedAt,
    stats,
    weak: weak.slice(0, GOVERNANCE_CAP),
    duplicate: duplicate.slice(0, GOVERNANCE_CAP),
    low_signal: lowSignal.slice(0, GOVERNANCE_CAP),
    dead_end: deadEnd.slice(0, GOVERNANCE_CAP),
    retirement_candidates: retirement.slice(0, GOVERNANCE_CAP),
  };
}

// ─────────────────────── Write: status transition (human-only) ─────────────

export interface TransitionInput {
  questionId: string;
  toStatus: LifecycleStatus;
  changedBy: string;
  reviewNotes?: string | null;
  qualityScore?: number | null; // optional explicit human override
}

export interface TransitionResult {
  ok: boolean;
  question_id: string;
  previous_status: LifecycleStatus | null;
  status: LifecycleStatus;
}

/** Thrown by transitionStatus when the question_id is not a real clarity question. */
export class QuestionNotFoundError extends Error {
  readonly code = 'QUESTION_NOT_FOUND';
  constructor(questionId: string) {
    super(`unknown question_id: ${questionId}`);
    this.name = 'QuestionNotFoundError';
  }
}

/**
 * The ONLY lifecycle-status writer. Human-driven (changedBy is an admin id),
 * audited (status_changed_at/by + review_notes). Bumps version when leaving a
 * pre-production state into 'active'. When a human supplies qualityScore it is
 * pinned (quality_overridden = true) so the refresh job won't overwrite it.
 */
export async function transitionStatus(pool: Pool, input: TransitionInput): Promise<TransitionResult> {
  await ensureQuestionRegistrySchema(pool);
  if (!isLifecycleStatus(input.toStatus)) {
    throw new Error(`invalid status: ${input.toStatus}`);
  }

  // Registry invariant: one row per real clarity question. Reject transitions on
  // unknown ids so a PATCH typo can never mint an orphan governance row.
  const exists = await pool.query(
    `SELECT 1 FROM capadex_clarity_questions WHERE question_id = $1 LIMIT 1`,
    [input.questionId],
  );
  if (exists.rowCount === 0) throw new QuestionNotFoundError(input.questionId);

  const prev = await pool.query<{ status: LifecycleStatus; version: number }>(
    `SELECT status, version FROM capadex_question_registry WHERE question_id = $1`,
    [input.questionId],
  );
  const previousStatus = prev.rows[0]?.status ?? null;
  const bumpVersion = previousStatus !== null
    && (previousStatus === 'draft' || previousStatus === 'testing')
    && input.toStatus === 'active';

  const overrideQuality = typeof input.qualityScore === 'number';
  const now = new Date().toISOString();

  const { rows } = await pool.query<{ status: LifecycleStatus }>(
    `INSERT INTO capadex_question_registry
        (question_id, status, status_changed_at, status_changed_by, review_notes,
         quality_score, quality_overridden, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$3,$3)
     ON CONFLICT (question_id) DO UPDATE SET
        status            = EXCLUDED.status,
        status_changed_at = EXCLUDED.status_changed_at,
        status_changed_by = EXCLUDED.status_changed_by,
        review_notes      = COALESCE(EXCLUDED.review_notes, capadex_question_registry.review_notes),
        version           = capadex_question_registry.version + ${bumpVersion ? 1 : 0},
        quality_score     = CASE WHEN ${overrideQuality ? 'TRUE' : 'FALSE'}
                                 THEN EXCLUDED.quality_score ELSE capadex_question_registry.quality_score END,
        quality_overridden = capadex_question_registry.quality_overridden OR ${overrideQuality ? 'TRUE' : 'FALSE'},
        updated_at        = EXCLUDED.updated_at
     RETURNING status`,
    [input.questionId, input.toStatus, now, input.changedBy,
     input.reviewNotes ?? null, overrideQuality ? clamp01(input.qualityScore as number) : null, overrideQuality],
  );

  return {
    ok: true,
    question_id: input.questionId,
    previous_status: previousStatus,
    status: rows[0]?.status ?? input.toStatus,
  };
}

// ───────────────────────────── util ────────────────────────────────────────

function emptyStatusCounts(): Record<LifecycleStatus, number> {
  return {
    draft: 0, testing: 0, active: 0,
    candidate_for_retirement: 0, deprecated: 0, archived: 0,
  };
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function round4(n: number): number { return Math.round(n * 1e4) / 1e4; }
function fmt(n: number | null): string { return n === null ? '—' : Number(n).toFixed(2); }
