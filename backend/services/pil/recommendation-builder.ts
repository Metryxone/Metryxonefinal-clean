/**
 * CAPADEX PIL — Phase 7: Recommendation Builder (orchestrator, read-only of intelligence).
 *
 *   COMPOSES existing runtime intelligence into four explainable, export-ready
 *   recommendation categories — Career / Learning / Project / Development — generated
 *   separately per stakeholder (Student / Parent / Counselor / Institution).
 *
 *   Pipeline:  load guidance + pipeline lineage + session interventions  →  derive the
 *   session's ACTIVE constructs (intervention construct_key = deepest trace; concern →
 *   construct = honest fallback)  →  generateRecommendations (catalog-anchored)  →
 *   attachRecommendationExplainability (8-node trace + coverage)  →  readiness + exports.
 *
 *   Persistence (best-effort, never throws): the composed output is upserted into the
 *   per-category tables + recommendation_explainability (delete-by-(session,stakeholder)
 *   + insert in one txn). Generation itself is pure.
 *
 * CANON: additive, read-only of intelligence, NO new scoring, NO new archetypes,
 *   deterministic, graceful degradation (missing input → honest empty category), never
 *   throws.
 */
import type { Pool, PoolClient } from 'pg';
import {
  buildGuidanceForSession,
  type GuidanceBundle,
} from './runtime-guidance-engine';
import {
  buildPipelineForSession,
  type PipelineResult,
  type PipelineHop,
} from './pipeline-resolver';
import {
  loadCatalog,
  type CatalogEntry,
  type RecCategory,
  type RecStakeholder,
  REC_STAKEHOLDERS,
  REC_CATEGORIES,
} from './recommendation-catalog';
import {
  generateRecommendations,
  type ActiveConstruct,
} from './recommendation-generator';
import { getSessionStage } from '../wc3/stage-intelligence';
import { getSessionOutcomes } from '../wc3/outcome-intelligence';
import { getSessionJourney } from '../wc3/journey-intelligence';
import { isWc3RecPersonalizationEnabled } from '../../config/feature-flags';
import {
  attachRecommendationExplainability,
  type TracedRecommendationSet,
  type TracedCategory,
  type RecExplainabilityCoverage,
} from './recommendation-explainability';
import { canonicalizeConstructKey, lookupConstruct } from '../../data/behavioural-constructs';

// ── Public shapes ────────────────────────────────────────────────────────────
export interface RecReadinessComponents {
  explainability: number;       // 0..1
  category_coverage: number;    // 0..1 — populated categories / 4
  data_completeness: number;    // 0..1 — 1 unless degraded
  specificity: number;          // 0..1 — 1 when any category has content
}
export interface RecReadinessScore {
  score: number;                // 0..100
  band: 'ready' | 'partial' | 'thin';
  components: RecReadinessComponents;
  note: string;
}

export type PdfBlockType = 'heading' | 'subheading' | 'paragraph' | 'bullet' | 'trace';
export interface PdfBlock { type: PdfBlockType; text: string; level?: number }
export interface RecExports {
  api_ready: Record<string, unknown>;
  print_ready: string;
  pdf_ready: PdfBlock[];
}

export interface SessionRecommendations {
  enabled: true;
  scope: 'session';
  session_id: string;
  stakeholder: RecStakeholder;
  generated_at: string;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  degraded: boolean;
  reason: string | null;
  active_constructs: ActiveConstruct[];
  categories: TracedCategory[];
  explainability: RecExplainabilityCoverage;
  readiness: RecReadinessScore;
  exports: RecExports;
}

export interface InstitutionRecommendations {
  enabled: true;
  scope: 'institution';
  stakeholder: 'institution';
  generated_at: string;
  cohort_size: number;
  session_ids: string[];
  degraded: boolean;
  reason: string | null;
  active_constructs: ActiveConstruct[];
  categories: TracedCategory[];
  explainability: RecExplainabilityCoverage;
  readiness: RecReadinessScore;
  exports: RecExports;
}

const COHORT_CAP = 200;
const round2 = (n: number) => Math.round(n * 100) / 100;

const CATEGORY_TABLE: Record<RecCategory, string> = {
  career: 'career_recommendations',
  learning: 'learning_recommendations',
  project: 'project_recommendations',
  development: 'development_recommendations',
};

// ── Lazy schema (canonical mirror of 20261201_recommendation_intelligence.sql) ───
let schemaPromise: Promise<void> | null = null;
export function ensureRecommendationSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  const categoryTable = (name: string) => `
    CREATE TABLE IF NOT EXISTS ${name} (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id         UUID NOT NULL,
      stakeholder        VARCHAR(20)  NOT NULL,
      recommendation_key VARCHAR(160) NOT NULL,
      sub_type           VARCHAR(40)  NOT NULL,
      anchor_construct   VARCHAR(120) NOT NULL,
      title              TEXT NOT NULL,
      description        TEXT NOT NULL,
      rationale          TEXT NOT NULL,
      rank               INTEGER NOT NULL DEFAULT 0,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_${name}_session ON ${name} (session_id, stakeholder);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_${name}_key ON ${name} (session_id, stakeholder, recommendation_key);`;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS recommendation_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_key VARCHAR(160) NOT NULL,
        category VARCHAR(20) NOT NULL, sub_type VARCHAR(40) NOT NULL,
        anchor_construct VARCHAR(120) NOT NULL, stakeholder VARCHAR(20) NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, rationale TEXT NOT NULL,
        effort VARCHAR(20), duration VARCHAR(40), horizon VARCHAR(40),
        priority INTEGER NOT NULL DEFAULT 2, is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_recommendation_library_key ON recommendation_library (recommendation_key, stakeholder);
      CREATE INDEX IF NOT EXISTS idx_recommendation_library_lookup ON recommendation_library (anchor_construct, category, stakeholder) WHERE is_active;
      ${categoryTable('career_recommendations')}
      ${categoryTable('learning_recommendations')}
      ${categoryTable('project_recommendations')}
      ${categoryTable('development_recommendations')}
      CREATE TABLE IF NOT EXISTS recommendation_explainability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL, stakeholder VARCHAR(20) NOT NULL, category VARCHAR(20) NOT NULL,
        recommendation_key VARCHAR(160) NOT NULL, anchor_construct VARCHAR(120) NOT NULL,
        trace JSONB NOT NULL DEFAULT '[]', traced BOOLEAN NOT NULL DEFAULT FALSE,
        chain_complete BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rec_explain_session ON recommendation_explainability (session_id, stakeholder);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_rec_explain_key ON recommendation_explainability (session_id, stakeholder, category, recommendation_key);
    `)
    .then(() => undefined)
    .catch((e) => { schemaPromise = null; throw e; });
  return schemaPromise;
}

// ── Active-construct derivation (read-only, never throws) ─────────────────────

/** Construct keys carried by the session's runtime interventions (deepest trace). */
async function loadInterventionConstructs(pool: Pool, sessionId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT construct_key FROM capadex_session_interventions WHERE session_id = $1`,
      [sessionId],
    );
    return rows.map((r) => canonicalizeConstructKey(r.construct_key)).filter((k): k is string => !!k);
  } catch {
    return [];
  }
}

/** Honest concern→construct fallback (only used when no interventions resolved). */
async function loadConcernConstructs(pool: Pool, pipeline: PipelineResult): Promise<string[]> {
  const concernId = pipeline.resolution?.concern_id ?? null;
  if (!concernId) return [];
  try {
    const { rows } = await pool.query(
      `SELECT concern_area FROM capadex_concerns_master WHERE concern_id = $1 LIMIT 1`,
      [concernId],
    );
    const area = rows[0]?.concern_area as string | undefined;
    const c = area ? lookupConstruct(area) : undefined;
    return c ? [c.key] : [];
  } catch {
    return [];
  }
}

async function deriveActiveConstructs(
  pool: Pool,
  sessionId: string,
  pipeline: PipelineResult,
): Promise<ActiveConstruct[]> {
  const fromInterventions = await loadInterventionConstructs(pool, sessionId);
  const active: ActiveConstruct[] = fromInterventions.map((key) => ({ key, source: 'intervention' as const }));
  if (active.length === 0) {
    const fromConcern = await loadConcernConstructs(pool, pipeline);
    for (const key of fromConcern) active.push({ key, source: 'concern' });
  }
  // Stable, de-duplicated order.
  const seen = new Set<string>();
  return active
    .sort((a, b) => a.key.localeCompare(b.key))
    .filter((ac) => (seen.has(ac.key) ? false : (seen.add(ac.key), true)));
}

// ── Readiness (deterministic; mirrors 6C computeReadiness, capped when degraded) ──
export function computeRecReadiness(
  categories: TracedCategory[],
  explainability: RecExplainabilityCoverage,
  degraded: boolean,
): RecReadinessScore {
  const total = categories.length || 1;
  const filled = categories.filter((c) => c.items.length > 0).length;
  const noContent = categories.every((c) => c.items.length === 0);
  const components: RecReadinessComponents = {
    // Empty sets are vacuously "fully explainable" (coverage 1); don't let that
    // inflate readiness — an empty set has no composed recommendations to be ready.
    explainability: noContent ? 0 : explainability.coverage,
    category_coverage: round2(filled / total),
    data_completeness: degraded ? 0.5 : 1,
    specificity: filled > 0 ? 1 : 0,
  };
  const raw =
    0.4 * components.explainability +
    0.3 * components.category_coverage +
    0.2 * components.data_completeness +
    0.1 * components.specificity;
  const score = Math.round(raw * 100);
  const rawBand: RecReadinessScore['band'] = score >= 80 ? 'ready' : score >= 50 ? 'partial' : 'thin';
  // A degraded chain can never read as fully "ready" — cap at partial (6C honesty lesson).
  // An empty set is always "thin" (no composed recommendations to assess).
  const band: RecReadinessScore['band'] = noContent
    ? 'thin'
    : degraded && rawBand === 'ready'
    ? 'partial'
    : rawBand;
  const note = noContent
    ? 'No composed recommendations for this scope yet — no resolved constructs matched the catalog.'
    : degraded
    ? (band === 'thin'
        ? 'Limited resolved intelligence — few recommendations could be composed for this scope.'
        : `Recommendations are usable and fully traceable to the resolved depth, but the lineage chain is partially resolved (${explainability.unresolved_hops} hop(s) unresolved).`)
    : (band === 'ready' ? 'Recommendations are complete and fully traceable through the chain.'
       : band === 'partial' ? 'Recommendations are usable but some categories are thin.'
       : 'Limited resolved intelligence for this scope.');
  return { score, band, components, note };
}

// ── Export shapes (pure) ─────────────────────────────────────────────────────
function buildPdfBlocks(title: string, metaLine: string, categories: TracedCategory[]): PdfBlock[] {
  const blocks: PdfBlock[] = [
    { type: 'heading', text: title, level: 1 },
    { type: 'paragraph', text: metaLine },
  ];
  for (const cat of categories) {
    blocks.push({ type: 'subheading', text: `${cat.category[0].toUpperCase()}${cat.category.slice(1)} Recommendations`, level: 2 });
    if (!cat.items.length && cat.note) { blocks.push({ type: 'paragraph', text: cat.note }); continue; }
    for (const item of cat.items) {
      blocks.push({ type: 'bullet', text: `[${item.sub_type}] ${item.title} — ${item.description}` });
      if (item.trace.length) blocks.push({ type: 'trace', text: `Trace: ${item.trace.map((t) => t.label).join('  ›  ')}` });
    }
  }
  return blocks;
}
function buildPrintText(blocks: PdfBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') lines.push('', `# ${b.text}`, '='.repeat(Math.min(60, b.text.length)));
    else if (b.type === 'subheading') lines.push('', `## ${b.text}`);
    else if (b.type === 'paragraph') lines.push(b.text);
    else if (b.type === 'bullet') lines.push(`  • ${b.text}`);
    else if (b.type === 'trace') lines.push(`      ${b.text}`);
  }
  return lines.join('\n').trim();
}
function buildExports(title: string, metaLine: string, body: Record<string, unknown>, categories: TracedCategory[]): RecExports {
  const pdf_ready = buildPdfBlocks(title, metaLine, categories);
  return { api_ready: body, print_ready: buildPrintText(pdf_ready), pdf_ready };
}

// ── Per-session assembly (pure given inputs) ─────────────────────────────────
function concernLabelOf(pipeline: PipelineResult): string | null {
  const hop = pipeline.hops.find((h) => h.key === 'signal_to_concern');
  const data = (hop?.data ?? null) as { concern_label?: string | null } | null;
  return data?.concern_label ?? null;
}

// ── WC-P2 Lever C — Recommendation Personalization Context (additive, flag-gated) ──
// Annotates the rec set with the session's stage / outcome / journey intelligence so
// downstream consumers can situate the (unchanged) recommendations. NEVER drops or
// re-ranks recs — purely descriptive. Flag OFF → omitted (byte-identical legacy set).
export interface RecPersonalizationContext {
  consumed: boolean;
  stage: { canonical_stage: string; score_level: string | null; confidence: number } | null;
  outcome: { models: number; actionability: number; explainability: number; unclassified: boolean } | null;
  journey: {
    primary_route: string;
    expected_outcome: string | null;
    route_confidence: number;
    confidence_band: string;
  } | null;
  sources: string[];
  note: string | null;
}

async function loadRecPersonalizationContext(pool: Pool, sessionId: string): Promise<RecPersonalizationContext | null> {
  if (!isWc3RecPersonalizationEnabled()) return null;
  try {
    const [stageState, outcomes, journey] = await Promise.all([
      getSessionStage(pool, sessionId).catch(() => null),
      getSessionOutcomes(pool, sessionId).catch(() => null),
      getSessionJourney(pool, sessionId).catch(() => null),
    ]);

    const stage = stageState && stageState.canonical_stage !== 'UNRESOLVED'
      ? { canonical_stage: stageState.canonical_stage, score_level: stageState.score_level, confidence: stageState.confidence }
      : null;
    const outcome = outcomes && !outcomes.unclassified
      ? { models: outcomes.models.length, actionability: outcomes.actionability, explainability: outcomes.explainability, unclassified: false }
      : null;
    const journeyCtx = journey && !journey.degraded
      ? {
          primary_route: journey.primary_route.display_label ?? journey.primary_route.route_key,
          expected_outcome: journey.expected_outcome,
          route_confidence: journey.route_confidence,
          confidence_band: journey.confidence_band,
        }
      : null;

    const sources: string[] = [];
    if (stage) sources.push('stage');
    if (outcome) sources.push('outcome');
    if (journeyCtx) sources.push('journey');
    const consumed = sources.length > 0;

    return {
      consumed,
      stage,
      outcome,
      journey: journeyCtx,
      sources,
      note: consumed ? null : 'No stage / outcome / journey intelligence resolved for this session yet.',
    };
  } catch (err) {
    console.warn('[rec-personalization] degrade:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function assembleSessionRecommendations(
  sessionId: string,
  stakeholder: RecStakeholder,
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
  catalog: CatalogEntry[],
  active: ActiveConstruct[],
  personalizationContext: RecPersonalizationContext | null = null,
): SessionRecommendations {
  const generated = generateRecommendations(catalog, active, pipeline.hops, stakeholder);
  const traced = attachRecommendationExplainability(generated, pipeline.hops);
  const degraded = pipeline.degraded || guidance.degraded || active.length === 0;
  const reason = active.length === 0 ? 'no_active_constructs' : (pipeline.reason ?? guidance.reason);
  const concern_label = concernLabelOf(pipeline);
  const readiness = computeRecReadiness(traced.categories, traced.explainability, degraded);
  const title = `${stakeholder[0].toUpperCase()}${stakeholder.slice(1)} Recommendations`;

  const body: Record<string, unknown> = {
    scope: 'session', session_id: sessionId, stakeholder,
    generated_at: pipeline.generated_at, archetype: guidance.archetype, concern_label,
    degraded, reason, active_constructs: traced.active_constructs,
    categories: traced.categories, explainability: traced.explainability, readiness,
    // WC-P2 Lever C — additive, omitted when flag OFF (byte-identical legacy set).
    ...(personalizationContext ? { personalization_context: personalizationContext } : {}),
  };
  const metaLine = [
    concern_label ? `Concern: ${concern_label}` : null,
    guidance.archetype ? `Archetype: ${guidance.archetype.name ?? guidance.archetype.key}` : null,
    degraded ? 'Status: partially resolved' : 'Status: fully resolved',
    `Generated: ${pipeline.generated_at}`,
  ].filter(Boolean).join('  ·  ');

  return {
    enabled: true, scope: 'session', session_id: sessionId, stakeholder,
    generated_at: pipeline.generated_at, archetype: guidance.archetype, concern_label,
    degraded, reason, active_constructs: traced.active_constructs,
    categories: traced.categories, explainability: traced.explainability, readiness,
    ...(personalizationContext ? { personalization_context: personalizationContext } : {}),
    exports: buildExports(title, metaLine, body, traced.categories),
  };
}

// ── DB orchestrators (read-only of intelligence, never throw) ────────────────
async function loadSessionInputs(pool: Pool, sessionId: string): Promise<{
  guidance: GuidanceBundle; pipeline: PipelineResult; active: ActiveConstruct[];
  personalizationContext: RecPersonalizationContext | null;
}> {
  const [guidance, pipeline] = await Promise.all([
    buildGuidanceForSession(pool, sessionId),
    buildPipelineForSession(pool, sessionId),
  ]);
  const active = await deriveActiveConstructs(pool, sessionId, pipeline);
  const personalizationContext = await loadRecPersonalizationContext(pool, sessionId);
  return { guidance, pipeline, active, personalizationContext };
}

export async function buildSessionRecommendations(
  pool: Pool,
  sessionId: string,
  stakeholder: RecStakeholder,
): Promise<SessionRecommendations> {
  const [{ guidance, pipeline, active, personalizationContext }, catalog] = await Promise.all([
    loadSessionInputs(pool, sessionId),
    loadCatalog(pool),
  ]);
  return assembleSessionRecommendations(sessionId, stakeholder, guidance, pipeline, catalog, active, personalizationContext);
}

export async function buildAllStakeholderRecommendations(
  pool: Pool,
  sessionId: string,
): Promise<Record<Exclude<RecStakeholder, 'institution'>, SessionRecommendations>> {
  const [{ guidance, pipeline, active, personalizationContext }, catalog] = await Promise.all([
    loadSessionInputs(pool, sessionId),
    loadCatalog(pool),
  ]);
  const mk = (s: RecStakeholder) => assembleSessionRecommendations(sessionId, s, guidance, pipeline, catalog, active, personalizationContext);
  return { student: mk('student'), parent: mk('parent'), counselor: mk('counselor') };
}

// ── Institution (cohort) recommendations ─────────────────────────────────────
interface CohortMember { session_id: string; pipeline: PipelineResult; active: ActiveConstruct[] }

/** Union resolved hops across members (first resolved instance per hop key wins). */
function unionLineage(allHops: PipelineHop[][]): PipelineHop[] {
  const byKey = new Map<string, PipelineHop>();
  for (const hops of allHops) for (const h of hops) {
    const existing = byKey.get(h.key);
    if (!existing || (!existing.resolved && h.resolved)) byKey.set(h.key, h);
  }
  return [...byKey.values()].sort((a, b) => a.step - b.step);
}

export async function buildInstitutionRecommendations(
  pool: Pool,
  sessionIds: string[],
): Promise<InstitutionRecommendations> {
  const ids = [...new Set(sessionIds.map((s) => String(s).trim()).filter(Boolean))].slice(0, COHORT_CAP);
  const catalog = await loadCatalog(pool);
  const members: CohortMember[] = [];
  for (const id of ids) {
    const loaded = await loadSessionInputs(pool, id).catch(() => null);
    if (loaded) members.push({ session_id: id, pipeline: loaded.pipeline, active: loaded.active });
  }
  // Cohort active constructs = union across members (intervention beats concern).
  const srcOf = new Map<string, ActiveConstruct['source']>();
  for (const m of members) for (const ac of m.active) {
    const prev = srcOf.get(ac.key);
    if (!prev || (prev === 'concern' && ac.source === 'intervention')) srcOf.set(ac.key, ac.source);
  }
  const active: ActiveConstruct[] = [...srcOf.entries()].map(([key, source]) => ({ key, source }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const lineage = unionLineage(members.map((m) => m.pipeline.hops));

  const generated = generateRecommendations(catalog, active, lineage, 'institution');
  const traced = attachRecommendationExplainability(generated, lineage);
  const degraded = members.length === 0 || active.length === 0 || members.some((m) => m.pipeline.degraded);
  const reason = members.length === 0 ? 'empty_cohort' : (active.length === 0 ? 'no_active_constructs' : (degraded ? 'partial_cohort_resolution' : null));
  const readiness = computeRecReadiness(traced.categories, traced.explainability, degraded);
  const generated_at = new Date().toISOString();
  const title = 'Institution Cohort Recommendations';
  const session_ids = members.map((m) => m.session_id).sort();

  const body: Record<string, unknown> = {
    scope: 'institution', stakeholder: 'institution', generated_at,
    cohort_size: members.length, session_ids, degraded, reason,
    active_constructs: traced.active_constructs, categories: traced.categories,
    explainability: traced.explainability, readiness,
  };
  const metaLine = `Cohort size: ${members.length}  ·  ${degraded ? 'Status: partially resolved' : 'Status: fully resolved'}  ·  Generated: ${generated_at}`;

  return {
    enabled: true, scope: 'institution', stakeholder: 'institution', generated_at,
    cohort_size: members.length, session_ids, degraded, reason,
    active_constructs: traced.active_constructs, categories: traced.categories,
    explainability: traced.explainability, readiness,
    exports: buildExports(title, metaLine, body, traced.categories),
  };
}

// ── Best-effort persistence (idempotent; never throws) ───────────────────────
export async function persistSessionRecommendations(
  pool: Pool,
  rec: SessionRecommendations,
): Promise<void> {
  let client: PoolClient | null = null;
  try {
    await ensureRecommendationSchema(pool);
    client = await pool.connect();
    await client.query('BEGIN');
    const sid = rec.session_id, sh = rec.stakeholder;
    for (const cat of REC_CATEGORIES) await client.query(`DELETE FROM ${CATEGORY_TABLE[cat]} WHERE session_id=$1 AND stakeholder=$2`, [sid, sh]);
    await client.query(`DELETE FROM recommendation_explainability WHERE session_id=$1 AND stakeholder=$2`, [sid, sh]);
    for (const cat of rec.categories) {
      const table = CATEGORY_TABLE[cat.category];
      for (const it of cat.items) {
        await client.query(
          `INSERT INTO ${table} (session_id, stakeholder, recommendation_key, sub_type, anchor_construct, title, description, rationale, rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (session_id, stakeholder, recommendation_key) DO NOTHING`,
          [sid, sh, it.recommendation_key, it.sub_type, it.anchor_construct, it.title, it.description, it.rationale, it.rank],
        );
        await client.query(
          `INSERT INTO recommendation_explainability (session_id, stakeholder, category, recommendation_key, anchor_construct, trace, traced, chain_complete)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
           ON CONFLICT (session_id, stakeholder, category, recommendation_key) DO NOTHING`,
          [sid, sh, cat.category, it.recommendation_key, it.anchor_construct, JSON.stringify(it.trace), it.traced, it.chain_complete],
        );
      }
    }
    await client.query('COMMIT');
  } catch {
    try { await client?.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    client?.release();
  }
}

export { REC_STAKEHOLDERS, REC_CATEGORIES };
