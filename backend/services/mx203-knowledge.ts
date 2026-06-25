/**
 * MX-203 — Knowledge Validation & Coverage composer (Phases 3–5).  READ-ONLY.
 *
 * Composes EXISTING knowledge surfaces into honest, separated views. It NEVER writes (GET-only),
 * NEVER recomputes scoring, and NEVER fabricates: every measurement is probed with to_regclass and
 * degrades to `null` (not measurable) — never silently to 0 — when a backing table is absent.
 *
 * Reused (not duplicated):
 *   - assessment-readiness (MX-101B) getCompetencyReadiness  → per-competency assessment gate.
 *   - onto_competency_content_drafts (governed staging)      → Draft/Approved knowledge coverage.
 *   - onto_competencies / onto_indicators / onto_role_competency_profiles / O*NET crosswalk / type
 *     map → Verified (source-backed) factual coverage.
 *
 * Honesty axes kept SEPARATE (never composited into one number): Verified ⟂ Draft ⟂ Approved
 * coverage; per-consumer readiness; per-competency health. Drafts (rule_based, needs_review) count
 * toward Draft coverage ONLY — never Verified, never Approved, never consumer-"ready".
 */
import type { Pool } from 'pg';
import { getCompetencyReadiness } from './assessment-readiness';

export const MX203_KNOWLEDGE_VERSION = 'mx203-knowledge-1.0.0';
const GENOME = 419;
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

async function regclass(pool: Pool, t: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) x`, [t]);
  return r.rows[0].x !== null;
}
async function scalar(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
/** distinct-competency count for a table, or null if the table is absent (NOT 0). */
async function distinctComps(pool: Pool, table: string, where = ''): Promise<number | null> {
  if (!(await regclass(pool, table))) return null;
  try { return await scalar(pool, `SELECT count(DISTINCT competency_id)::int n FROM ${table} ${where}`); }
  catch { return null; }
}

/* ------------------------------------------------------------------ *
 *  KNOWLEDGE COVERAGE — Verified ⟂ Draft ⟂ Approved (Phases 1/2/4)   *
 * ------------------------------------------------------------------ */

/** The full governed-attribute catalogue (MX-202B + MX-203). */
const GOVERNED_ATTRS = [
  'behavioural_indicator', 'observable_behaviour', 'proficiency_anchor',
  'evidence_requirement', 'learning_outcome', 'function_map', 'industry_map', 'department_map',
  'coaching_guidance', 'interview_guidance', 'development_activity',
] as const;

export async function getKnowledgeCoverage(pool: Pool) {
  const haveDrafts = await regclass(pool, 'onto_competency_content_drafts');

  // ---- Verified (source-backed factual) coverage — live in canonical tables ----
  const verified: { attribute: string; live_n: number | null }[] = [
    { attribute: 'definition', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND definition IS NOT NULL AND definition<>''`) },
    { attribute: 'domain', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND domain_id IS NOT NULL`) },
    { attribute: 'family', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND family_id IS NOT NULL`) },
    { attribute: 'scientific_type', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND scientific_type IS NOT NULL`) },
    { attribute: 'scoring_metadata', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND scoring_metadata IS NOT NULL`) },
    { attribute: 'benchmark_metadata', live_n: await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND benchmark_metadata IS NOT NULL AND benchmark_metadata::text NOT IN ('null','{}')`) },
    { attribute: 'type_classification', live_n: await distinctComps(pool, 'onto_competency_type_map') },
    { attribute: 'onet_crosswalk', live_n: await distinctComps(pool, 'onto_competency_onet_crosswalk') },
    { attribute: 'role_dna', live_n: await distinctComps(pool, 'onto_role_competency_profiles') },
    { attribute: 'behavioural_indicators', live_n: await distinctComps(pool, 'onto_indicators') },
  ];
  const verifiedMeasurable = verified.filter((v) => v.live_n !== null);
  const verifiedCoverage = pct(
    verifiedMeasurable.reduce((s, v) => s + Math.min(GENOME, v.live_n as number), 0),
    verifiedMeasurable.length * GENOME);

  // ---- Draft / Approved knowledge coverage from the governed staging ----
  const draftByAttr: Record<string, number> = {};
  const approvedByAttr: Record<string, number> = {};
  if (haveDrafts) {
    for (const r of (await pool.query(
      `SELECT attribute_type, status, count(DISTINCT competency_id)::int n
         FROM onto_competency_content_drafts GROUP BY attribute_type, status`)).rows) {
      if (r.status === 'draft') draftByAttr[r.attribute_type] = Number(r.n);
      if (r.status === 'approved' || r.status === 'verified') approvedByAttr[r.attribute_type] = (approvedByAttr[r.attribute_type] ?? 0) + Number(r.n);
    }
  }
  const draftCoverage = haveDrafts
    ? pct(GOVERNED_ATTRS.reduce((s, a) => s + Math.min(GENOME, draftByAttr[a] ?? 0), 0), GOVERNED_ATTRS.length * GENOME)
    : null;
  const approvedCoverage = haveDrafts
    ? pct(GOVERNED_ATTRS.reduce((s, a) => s + Math.min(GENOME, approvedByAttr[a] ?? 0), 0), GOVERNED_ATTRS.length * GENOME)
    : null;

  const attribute_matrix = GOVERNED_ATTRS.map((a) => ({
    attribute: a,
    draft_comps: haveDrafts ? (draftByAttr[a] ?? 0) : null,
    approved_comps: haveDrafts ? (approvedByAttr[a] ?? 0) : null,
  }));

  return {
    ok: true, version: MX203_KNOWLEDGE_VERSION, genome: GENOME,
    coverage: {
      verified_pct: verifiedCoverage,         // source-backed factual, LIVE
      draft_pct: draftCoverage,               // governed drafts (needs_review), NOT live
      approved_pct: approvedCoverage,         // human-approved → live in canonical homes
    },
    verified_breakdown: verified,
    governed_attribute_matrix: attribute_matrix,
    notes: {
      separation: 'Verified, Draft, and Approved are THREE independent axes — never combined. Drafts are rule_based proposals awaiting human approval; nothing auto-promotes.',
      phase1_data_block: 'Verified coverage < 100% is an HONEST gap: O*NET crosswalk is exhausted (~137/419) and benchmark/role-DNA have no machine source. Raising it requires a licensed dataset (ESCO/NICE/SFIA), SME authoring, or OPENAI_API_KEY-backed assisted authoring — never fabricated.',
    },
  };
}

/* ------------------------------------------------------------------ *
 *  PER-COMPETENCY HEALTH (Phase 4)                                    *
 * ------------------------------------------------------------------ */

export async function getCompetencyHealth(pool: Pool, opts: { limit?: number; competencyId?: string } = {}) {
  const haveDrafts = await regclass(pool, 'onto_competency_content_drafts');
  const haveRoleDna = await regclass(pool, 'onto_role_competency_profiles');
  const haveIndicators = await regclass(pool, 'onto_indicators');
  const haveOnet = await regclass(pool, 'onto_competency_onet_crosswalk');

  const args: any[] = [];
  let filter = '';
  if (opts.competencyId) { args.push(opts.competencyId); filter = `AND c.id = $${args.length}`; }

  const rows = (await pool.query(`
    SELECT c.id, c.canonical_name,
      (c.definition IS NOT NULL AND c.definition<>'') AS has_definition,
      (c.domain_id IS NOT NULL) AS has_domain,
      (c.scientific_type IS NOT NULL) AS has_type,
      (c.scoring_metadata IS NOT NULL) AS has_scoring,
      (c.benchmark_metadata IS NOT NULL AND c.benchmark_metadata::text NOT IN ('null','{}')) AS has_benchmark
    FROM onto_competencies c
    WHERE c.deprecated IS NOT TRUE ${filter}
    ORDER BY c.canonical_name`, args)).rows;

  const setOf = async (table: string, present: boolean): Promise<Set<string>> => {
    if (!present) return new Set();
    const r = await pool.query(`SELECT DISTINCT competency_id FROM ${table}`);
    return new Set(r.rows.map((x: any) => String(x.competency_id)));
  };
  const roleDnaSet = await setOf('onto_role_competency_profiles', haveRoleDna);
  const indicatorSet = await setOf('onto_indicators', haveIndicators);
  const onetSet = await setOf('onto_competency_onet_crosswalk', haveOnet);
  const draftSet = new Map<string, Set<string>>();   // competency_id -> attribute_types with a draft
  if (haveDrafts) {
    for (const r of (await pool.query(`SELECT DISTINCT competency_id, attribute_type FROM onto_competency_content_drafts WHERE status='draft'`)).rows) {
      const cid = String(r.competency_id);
      if (!draftSet.has(cid)) draftSet.set(cid, new Set());
      draftSet.get(cid)!.add(r.attribute_type);
    }
  }

  // Verified factual attributes that count toward HEALTH (each present → live truth).
  const VERIFIED_ATTRS = ['has_definition', 'has_domain', 'has_type', 'has_scoring', 'has_benchmark', 'role_dna', 'indicators', 'onet'];

  const items = rows.map((r: any) => {
    const cid = String(r.id);
    const verifiedFlags: Record<string, boolean> = {
      has_definition: r.has_definition, has_domain: r.has_domain, has_type: r.has_type,
      has_scoring: r.has_scoring, has_benchmark: r.has_benchmark,
      role_dna: roleDnaSet.has(cid), indicators: indicatorSet.has(cid), onet: onetSet.has(cid),
    };
    const verifiedCount = VERIFIED_ATTRS.filter((k) => verifiedFlags[k]).length;
    const draftCount = draftSet.get(cid)?.size ?? 0;
    return {
      competency_id: cid, canonical_name: r.canonical_name,
      verified_attributes: verifiedCount, verified_total: VERIFIED_ATTRS.length,
      health_pct: pct(verifiedCount, VERIFIED_ATTRS.length),
      draft_attributes_pending: draftCount,
      flags: verifiedFlags,
    };
  });
  items.sort((a, b) => (a.verified_attributes - b.verified_attributes) || a.canonical_name.localeCompare(b.canonical_name));

  const limit = Math.min(Math.max(Number(opts.limit) || 1000, 1), 2000);
  const dist = { healthy: 0, partial: 0, weak: 0 };
  for (const it of items) {
    if ((it.health_pct ?? 0) >= 75) dist.healthy++;
    else if ((it.health_pct ?? 0) >= 40) dist.partial++;
    else dist.weak++;
  }
  return {
    ok: true, version: MX203_KNOWLEDGE_VERSION, genome: GENOME, count: items.length,
    distribution: dist,
    measurability: { role_dna: haveRoleDna, indicators: haveIndicators, onet: haveOnet, drafts: haveDrafts },
    items: items.slice(0, limit),
  };
}

/* ------------------------------------------------------------------ *
 *  CONSUMER READINESS — 9 consumers (Phase 3)                         *
 * ------------------------------------------------------------------ */

export const KNOWLEDGE_CONSUMERS = [
  'assessment', 'adaptive_assessment', 'role_dna', 'career_builder', 'employability_index',
  'employer_matching', 'interview_intelligence', 'career_passport', 'report_factory',
] as const;
export type ConsumerStatus = 'ready' | 'partial' | 'not_ready' | 'not_measurable';

export async function getConsumerReadiness(pool: Pool, opts: { limit?: number } = {}) {
  const haveRoleDna = await regclass(pool, 'onto_role_competency_profiles');
  const haveIndicators = await regclass(pool, 'onto_indicators');
  const haveInterviewHome = await regclass(pool, 'onto_competency_interview_guidance');
  const haveDrafts = await regclass(pool, 'onto_competency_content_drafts');

  // assessment gate per competency (MX-101B) — base_ready + distinct_diffs.
  const readiness = await getCompetencyReadiness(pool, { limit: 2000 }).catch(() => ({ items: [] as any[] }));
  const assess = new Map<string, { base_ready: boolean; distinct_diffs: number; n_approved: number }>();
  for (const it of (readiness as any).items ?? []) {
    assess.set(String(it.competency_id), { base_ready: !!it.base_ready, distinct_diffs: Number(it.distinct_diffs ?? 0), n_approved: Number(it.n_approved ?? 0) });
  }

  const comps = (await pool.query(`
    SELECT c.id, c.canonical_name,
      (c.definition IS NOT NULL AND c.definition<>'') AS has_definition,
      (c.domain_id IS NOT NULL) AS has_domain,
      (c.scientific_type IS NOT NULL) AS has_type,
      (c.scoring_metadata IS NOT NULL) AS has_scoring,
      (c.benchmark_metadata IS NOT NULL AND c.benchmark_metadata::text NOT IN ('null','{}')) AS has_benchmark
    FROM onto_competencies c WHERE c.deprecated IS NOT TRUE ORDER BY c.canonical_name`)).rows;

  const roleDnaSet = haveRoleDna ? new Set((await pool.query(`SELECT DISTINCT competency_id FROM onto_role_competency_profiles`)).rows.map((r: any) => String(r.competency_id))) : null;
  const indicatorSet = haveIndicators ? new Set((await pool.query(`SELECT DISTINCT competency_id FROM onto_indicators`)).rows.map((r: any) => String(r.competency_id))) : null;
  const interviewLiveSet = haveInterviewHome ? new Set((await pool.query(`SELECT DISTINCT competency_id FROM onto_competency_interview_guidance`)).rows.map((r: any) => String(r.competency_id))) : null;
  const interviewDraftSet = haveDrafts ? new Set((await pool.query(`SELECT DISTINCT competency_id FROM onto_competency_content_drafts WHERE attribute_type='interview_guidance' AND status='draft'`)).rows.map((r: any) => String(r.competency_id))) : null;

  const tri = (ready: boolean, partial: boolean, measurable = true): ConsumerStatus =>
    !measurable ? 'not_measurable' : ready ? 'ready' : partial ? 'partial' : 'not_ready';

  const items = comps.map((c: any) => {
    const cid = String(c.id);
    const a = assess.get(cid) ?? { base_ready: false, distinct_diffs: 0, n_approved: 0 };
    const roleDna = roleDnaSet ? roleDnaSet.has(cid) : false;
    const statuses: Record<string, ConsumerStatus> = {
      assessment: tri(a.base_ready, a.n_approved > 0),
      // true adaptive flow needs >=3 distinct difficulty bands (live bank is largely single-band → honest low coverage).
      adaptive_assessment: tri(a.base_ready && a.distinct_diffs >= 3, a.base_ready),
      role_dna: tri(roleDna, false, !!roleDnaSet),
      career_builder: tri(c.has_definition && roleDna, c.has_definition, !!roleDnaSet),
      employability_index: tri(c.has_type && c.has_scoring, c.has_type || c.has_scoring),
      employer_matching: tri(a.base_ready && roleDna, roleDna, !!roleDnaSet),
      interview_intelligence: tri(
        (interviewLiveSet?.has(cid) ?? false) || (indicatorSet?.has(cid) ?? false),
        interviewDraftSet?.has(cid) ?? false,
        !!(interviewLiveSet || indicatorSet || interviewDraftSet)),
      career_passport: tri(c.has_definition && c.has_domain, c.has_definition),
      report_factory: tri(c.has_benchmark && c.has_scoring, c.has_benchmark || c.has_scoring),
    };
    return { competency_id: cid, canonical_name: c.canonical_name, statuses };
  });

  // rollup per consumer
  const rollup: Record<string, { ready: number; partial: number; not_ready: number; not_measurable: number; ready_pct: number | null }> = {};
  for (const consumer of KNOWLEDGE_CONSUMERS) {
    const counts = { ready: 0, partial: 0, not_ready: 0, not_measurable: 0 };
    for (const it of items) counts[it.statuses[consumer]]++;
    const measurable = items.length - counts.not_measurable;
    rollup[consumer] = { ...counts, ready_pct: pct(counts.ready, measurable) };
  }

  const limit = Math.min(Math.max(Number(opts.limit) || 1000, 1), 2000);
  return {
    ok: true, version: MX203_KNOWLEDGE_VERSION, genome: GENOME, consumers: KNOWLEDGE_CONSUMERS,
    rollup, count: items.length, items: items.slice(0, limit),
    notes: {
      separation: 'A consumer is "ready" ONLY when its REAL backing data is present (assessment gate, Role DNA, scoring, etc.). Governed drafts make a consumer "partial" at most — never "ready" — until a human approves. Absent backing → not_measurable (null), never counted as ready or 0.',
    },
  };
}

/* ------------------------------------------------------------------ *
 *  FOUNDER ROLLUP (Phase 5)                                           *
 * ------------------------------------------------------------------ */

export async function getFounderKnowledgeRollup(pool: Pool) {
  const [coverage, health, consumers] = await Promise.all([
    getKnowledgeCoverage(pool),
    getCompetencyHealth(pool, { limit: 25 }),
    getConsumerReadiness(pool, { limit: 1 }),
  ]);

  // SME review backlog = governed drafts still needing review (the human-approval queue).
  const haveDrafts = await regclass(pool, 'onto_competency_content_drafts');
  const backlog = haveDrafts ? await scalar(pool, `SELECT count(*)::int n FROM onto_competency_content_drafts WHERE needs_review=TRUE AND status='draft'`) : null;
  const backlogComps = haveDrafts ? await scalar(pool, `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_content_drafts WHERE needs_review=TRUE AND status='draft'`) : null;

  const weakest = health.items.slice(0, 15).map((h) => ({ competency_id: h.competency_id, canonical_name: h.canonical_name, health_pct: h.health_pct, verified_attributes: h.verified_attributes }));

  // consumers with the lowest real readiness = highest-risk surfaces.
  const riskAreas = Object.entries(consumers.rollup)
    .map(([consumer, r]) => ({ consumer, ready_pct: r.ready_pct }))
    .sort((a, b) => (a.ready_pct ?? 101) - (b.ready_pct ?? 101))
    .slice(0, 5);

  return {
    ok: true, version: MX203_KNOWLEDGE_VERSION, genome: GENOME, generated_at: new Date().toISOString(),
    knowledge_completion: {
      verified_pct: coverage.coverage.verified_pct,
      draft_pct: coverage.coverage.draft_pct,
      approved_pct: coverage.coverage.approved_pct,
    },
    health_distribution: health.distribution,
    sme_review_backlog: { drafts_pending: backlog, competencies_pending: backlogComps },
    weakest_competencies: weakest,
    highest_risk_consumers: riskAreas,
    data_block: {
      phase1_factual: 'DATA-BLOCKED — Verified coverage cannot be raised by code alone. Levers: licensed ESCO/NICE/SFIA dataset import, SME authoring, or OPENAI_API_KEY-assisted authoring. Nothing fabricated.',
    },
    honesty: 'Verified ⟂ Draft ⟂ Approved coverage and per-consumer readiness are reported separately and never combined into a single completion number. null ≠ 0 throughout.',
  };
}
