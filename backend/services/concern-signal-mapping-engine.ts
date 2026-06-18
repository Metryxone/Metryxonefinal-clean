/**
 * CAPADEX Concern → Signal Mapping Engine (Task #16).
 *
 * Links every concern in `capadex_concerns_master` to the signals that should be
 * monitored when that concern is raised, across three tiers of the existing
 * Signal Ontology:
 *
 *   - **Tier-3** curated signals (`capadex_signals`, 20 richly-named rows) — the
 *     precise, semantic backbone of the mapping.
 *   - **Composite** signals — the `hidden_pattern_contribution` clusters that the
 *     composite engine derives dynamically; a concern inherits the composites of
 *     its mapped Tier-3 signals (only clusters that actually form a composite
 *     definition are emitted).
 *   - **Atomic** signals (`capadex_atomic_signals`, ~16k rows) — only coarsely
 *     linkable via the 6 ontology `relational_bridge_tag` buckets, so atomic
 *     mappings are recorded at bridge-tag granularity (count + representative
 *     sample), never as fabricated per-concern precision.
 *
 * Resolution cascade (per the task): exact `relational_bridge_tag` → cluster /
 * domain-category → keyword/token overlap → orphan. The dominant contributor
 * sets the row's `match_method`; every mapping carries a confidence (0..1)
 * derived from the resolution method **and** the ontology's own
 * severity/confidence weights.
 *
 * Quality over coverage: a concern that resolves to no Tier-3 signal is recorded
 * as an explicit `orphan` row — flagged for review, never filled with fabricated
 * signals. The pure `mapConcernToSignals()` is deterministic and unit-testable;
 * all I/O lives in the orchestration around it.
 */
import type { Pool, PoolClient } from 'pg';
import { coreToken, loadCompositeRuntime } from './composite-signal-engine';

// ── Tunables ────────────────────────────────────────────────────────────────
const STRONG_SCORE = 1.5;   // raw score at/above this → a primary (strong/moderate) match
const WEAK_SCORE = 0.5;     // raw score at/above this (but below STRONG) → a weak match
const MAX_TIER3_PER_CONCERN = 4;
const ATOMIC_SAMPLE_SIZE = 6;

const STRONG_BAND = 0.7;
const MODERATE_BAND = 0.45;

export type SignalTier = 'tier3' | 'atomic' | 'composite' | 'orphan';
export type MatchMethod =
  | 'bridge_exact'
  | 'token_semantic'
  | 'domain_category'
  | 'cluster_match'
  | 'bridge_fallback'
  | 'composite_derived'
  | 'atomic_bridge'
  | 'orphan';
export type ConfidenceBand = 'strong' | 'moderate' | 'weak' | 'none';

// The 6 ontology domain *categories* used by `capadex_signals.domain`.
const SIGNAL_DOMAINS = ['cognitive', 'emotional', 'behavioral', 'social', 'motivational', 'executive_function'] as const;

/**
 * Curated synonym expansion per Tier-3 signal core-token. Grounded in each
 * signal's behavioural meaning; lets concern prose ("self-doubt", "time
 * management", "placement") resolve to the right signal even when it never uses
 * the signal's exact name. Substrings are matched against the concern corpus, so
 * stems ("procrastinat", "employab") catch their inflections.
 */
const SIGNAL_KEYWORDS: Record<string, string[]> = {
  career_confusion: ['career', 'direction', 'clarity', 'confus', 'indeci', 'path', 'goal', 'aimless'],
  future_uncertainty: ['future', 'uncertain', 'unclear', 'unknown', 'ambigu', 'worry about future'],
  fear_of_failure: ['fail', 'failure', 'fear', 'mistake', 'perfection', 'not good enough', 'rejection'],
  placement_anxiety: ['placement', 'job', 'recruit', 'hiring', 'employ', 'campus', 'offer', 'anxiety'],
  peer_comparison: ['compar', 'peer', 'others', 'jealous', 'inferior', 'left behind', 'fomo'],
  confidence_instability: ['confiden', 'insecur', 'doubt', 'shaky', 'unstable', 'self-belief', 'self belief'],
  decision_paralysis: ['decision', 'indeci', 'choose', 'choice', 'stuck', 'paralys', 'cant decide'],
  avoidance_behavior: ['avoid', 'escape', 'withdraw', 'disengage', 'skip', 'put off', 'procrastinat'],
  procrastination_pattern: ['procrastinat', 'delay', 'deadline', 'postpone', 'time management', 'consistency', 'discipline', 'habit', 'routine'],
  emotional_overload: ['emotion', 'overwhelm', 'overload', 'flooded', 'too much', 'pressure', 'stress'],
  hopelessness: ['hopeless', 'despair', 'meaning', 'purpose', 'giving up', 'give up', 'depress', 'worthless'],
  low_self_belief: ['self-belief', 'self belief', 'esteem', 'worth', 'inadequa', 'not capable', 'low confiden'],
  motivation_decline: ['motivat', 'drive', 'interest', 'engage', 'apathy', 'lazy', 'lack of', 'disinterest'],
  burnout_tendency: ['burnout', 'burn out', 'exhaust', 'fatigue', 'drained', 'depleted', 'overwork'],
  overthinking_pattern: ['overthink', 'rumin', 'analys', 'spiral', 'racing thoughts', 'cant stop thinking'],
  external_dependency: ['depend', 'validation', 'approval', 'external', 'reliance', 'reassurance'],
  social_withdrawal: ['withdraw', 'isolat', 'lonely', 'social', 'shy', 'introvert', 'alone'],
  interview_fear: ['interview', 'speaking', 'presentation', 'public speaking', 'communicat', 'stage'],
  employability_insecurity: ['employab', 'skill gap', 'unprepared', 'not ready', 'industry', 'market', 'readiness'],
  practical_skill_gap: ['skill', 'practical', 'competen', 'ability', 'gap', 'technical', 'hands-on', 'application'],
};

/** Domain-category inference from concern prose → one of the 6 signal domains. */
const DOMAIN_CATEGORY_RULES: Array<{ cat: typeof SIGNAL_DOMAINS[number]; kw: string[] }> = [
  { cat: 'emotional', kw: ['emotion', 'anxiety', 'stress', 'regulation', 'recovery', 'wellbeing', 'mental', 'mood', 'fear'] },
  { cat: 'cognitive', kw: ['cognit', 'thinking', 'academic', 'exam', 'learning', 'memory', 'attention', 'focus', 'clarity'] },
  { cat: 'behavioral', kw: ['behavi', 'habit', 'discipline', 'consistency', 'procrast', 'routine', 'lifestyle', 'addiction'] },
  { cat: 'social', kw: ['social', 'communicat', 'peer', 'relationship', 'collaborat', 'leadership', 'family', 'interpersonal'] },
  { cat: 'motivational', kw: ['motivat', 'values', 'responsib', 'drive', 'ownership', 'purpose', 'meaning', 'goal'] },
  { cat: 'executive_function', kw: ['execution', 'planning', 'organis', 'organiz', 'employab', 'career', 'skill', 'readiness', 'competency'] },
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'into', 'from', 'this', 'that', 'their', 'your', 'over', 'under', 'about',
  'concern', 'signals', 'signal', 'cluster', 'group', 'level', 'dom', 'col', 'emp', 'dis', 'adj', 'car',
  'general', 'high', 'low', 'poor', 'weak', 'lack', 'difficulty', 'issues', 'related', 'within', 'across',
]);

// ── Ontology load ─────────────────────────────────────────────────────────────
export interface Tier3SignalDef {
  signal_id: string;
  signal_name: string;
  token: string;
  domain: string;            // ontology category
  bridge_tag: string;        // normalised
  hpc_cluster: string;       // hidden_pattern_contribution
  severity: number;
  confidence: number;        // confidence_weight
  persistence: number;
  nameTokens: string[];
  hpcTokens: string[];
  keywords: string[];
}

export interface AtomicBridgeAgg {
  bridge_tag: string;
  count: number;
  avg_severity: number;
  avg_confidence: number;
  avg_persistence: number;
  sample_ids: string[];
}

export interface MappingOntology {
  tier3: Tier3SignalDef[];
  atomicByTag: Map<string, AtomicBridgeAgg>;     // normalised bridge_tag → aggregate
  compositeKeys: Set<string>;                    // clusters that actually form a composite definition
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toUpperCase();
}

function splitTokens(s: unknown): string[] {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/s$/, '')) // crude singularise
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Load the full mapping ontology: Tier-3 signal definitions, per-bridge-tag
 * atomic aggregates, and the set of clusters that genuinely form a composite
 * (so composite mappings are only emitted for reachable composites).
 */
export async function loadMappingOntology(pool: Pool): Promise<MappingOntology> {
  const tier3: Tier3SignalDef[] = [];
  const atomicByTag = new Map<string, AtomicBridgeAgg>();
  const compositeKeys = new Set<string>();

  const sig = await pool.query<{
    signal_id: string; signal_name: string; domain: string | null; relational_bridge_tag: string | null;
    hidden_pattern_contribution: string | null; severity_weight: number | null;
    confidence_weight: number | null; persistence_weight: number | null;
  }>(
    `SELECT signal_id, signal_name, domain, relational_bridge_tag, hidden_pattern_contribution,
            severity_weight, confidence_weight, persistence_weight
       FROM capadex_signals ORDER BY signal_id`,
  );
  for (const r of sig.rows) {
    const token = coreToken(r.signal_name);
    const hpcTokens = splitTokens((r.hidden_pattern_contribution || '').replace(/cluster/gi, ''));
    tier3.push({
      signal_id: r.signal_id,
      signal_name: r.signal_name,
      token,
      domain: (r.domain || 'general').toLowerCase(),
      bridge_tag: norm(r.relational_bridge_tag),
      hpc_cluster: String(r.hidden_pattern_contribution || '').trim(),
      severity: Number(r.severity_weight) || 0.5,
      confidence: Number(r.confidence_weight) || 0.5,
      persistence: Number(r.persistence_weight) || 0.5,
      nameTokens: splitTokens(r.signal_name),
      hpcTokens,
      keywords: SIGNAL_KEYWORDS[token] || [],
    });
  }

  const atomic = await pool.query<{
    relational_bridge_tag: string | null; n: string;
    avg_sev: number | null; avg_conf: number | null; avg_pers: number | null;
  }>(
    `SELECT relational_bridge_tag,
            COUNT(*) n,
            AVG(severity_weight) avg_sev,
            AVG(confidence_weight) avg_conf,
            AVG(persistence_weight) avg_pers
       FROM capadex_atomic_signals
      GROUP BY relational_bridge_tag`,
  );
  for (const r of atomic.rows) {
    const tag = norm(r.relational_bridge_tag);
    if (!tag) continue;
    const sample = await pool.query<{ atomic_signal_id: string }>(
      `SELECT atomic_signal_id FROM capadex_atomic_signals
        WHERE relational_bridge_tag = $1
        ORDER BY severity_weight DESC NULLS LAST, atomic_signal_id
        LIMIT $2`,
      [r.relational_bridge_tag, ATOMIC_SAMPLE_SIZE],
    );
    atomicByTag.set(tag, {
      bridge_tag: tag,
      count: Number(r.n) || 0,
      avg_severity: Number(r.avg_sev) || 0.5,
      avg_confidence: Number(r.avg_conf) || 0.5,
      avg_persistence: Number(r.avg_pers) || 0.5,
      sample_ids: sample.rows.map((x) => x.atomic_signal_id),
    });
  }

  // Reuse the production composite engine's definition logic so the set of
  // reachable composites here is identical to what the runtime actually forms.
  const compRuntime = await loadCompositeRuntime(pool, true);
  for (const def of compRuntime.definitions) compositeKeys.add(def.composite_key);

  return { tier3, atomicByTag, compositeKeys };
}

// ── Pure mapping ──────────────────────────────────────────────────────────────
export interface ConcernInput {
  id: number;
  concern_id: string | null;
  domain: string | null;
  concern_cluster: string | null;
  signal_cluster: string | null;
  root_cause_group: string | null;
  display_label: string | null;
  concern_category: string | null;
  intelligence_layer: string | null;
  assessment_dimension: string | null;
  intervention_lens: string | null;
  relational_bridge_tag: string | null;
}

export interface MappingRow {
  concern_pk: number;
  concern_id: string | null;
  relational_bridge_tag: string | null;
  signal_tier: SignalTier;
  signal_ref: string;
  signal_name: string | null;
  domain: string | null;
  match_method: MatchMethod;
  score: number;
  confidence: number;
  confidence_band: ConfidenceBand;
  severity_weight: number | null;
  metadata: Record<string, unknown>;
}

function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= STRONG_BAND) return 'strong';
  if (confidence >= MODERATE_BAND) return 'moderate';
  return 'weak';
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function inferDomainCategory(text: string): string | null {
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.kw.some((k) => text.includes(k))) return rule.cat;
  }
  return null;
}

interface SignalScore {
  def: Tier3SignalDef;
  score: number;
  method: MatchMethod;
  nameHits: number;
  synHits: number;
  hpcHits: number;
  bridgeExact: boolean;
  domainMatch: boolean;
}

/**
 * Pure, deterministic resolution of a single concern to its signals. Returns the
 * full set of mapping rows for the concern (Tier-3 + derived composites + a
 * coarse atomic bridge-tag link), or a single `orphan` row when nothing resolves.
 */
export function mapConcernToSignals(concern: ConcernInput, ontology: MappingOntology): MappingRow[] {
  const corpus = [
    concern.display_label, concern.concern_cluster, concern.signal_cluster, concern.root_cause_group,
    concern.domain, concern.concern_category, concern.intelligence_layer,
    concern.assessment_dimension, concern.intervention_lens,
  ].filter(Boolean).join(' ').toLowerCase();
  const corpusTokens = new Set(splitTokens(corpus));
  const concernTag = norm(concern.relational_bridge_tag);
  const inferredCat = inferDomainCategory(corpus);

  // Score every Tier-3 signal.
  const scores: SignalScore[] = [];
  for (const def of ontology.tier3) {
    const nameHits = def.nameTokens.filter((t) => corpusTokens.has(t)).length;
    const hpcHits = def.hpcTokens.filter((t) => corpusTokens.has(t)).length;
    const synHits = def.keywords.filter((k) => corpus.includes(k)).length;
    const bridgeExact = !!concernTag && concernTag === def.bridge_tag && def.bridge_tag !== 'GENERAL_CONCERN';
    const domainMatch = !!inferredCat && inferredCat === def.domain;

    let score = nameHits * 1.0 + synHits * 0.7 + hpcHits * 0.4;
    if (bridgeExact) score += 0.8;
    if (domainMatch) score += 0.5;
    if (score <= 0) continue;

    let method: MatchMethod = 'domain_category';
    if (nameHits > 0 || synHits > 0) method = 'token_semantic';
    else if (hpcHits > 0) method = 'cluster_match';
    if (bridgeExact && score - 0.8 < WEAK_SCORE) method = 'bridge_exact';

    scores.push({ def, score, method, nameHits, synHits, hpcHits, bridgeExact, domainMatch });
  }
  scores.sort((a, b) => b.score - a.score || a.def.signal_id.localeCompare(b.def.signal_id));

  const rows: MappingRow[] = [];
  const baseRow = {
    concern_pk: concern.id,
    concern_id: concern.concern_id,
    relational_bridge_tag: concern.relational_bridge_tag,
  };

  // Select primary Tier-3 matches: all strong, else the best weak ones.
  const strong = scores.filter((s) => s.score >= STRONG_SCORE).slice(0, MAX_TIER3_PER_CONCERN);
  let chosen: SignalScore[];
  if (strong.length > 0) {
    chosen = strong;
  } else {
    const weak = scores.filter((s) => s.score >= WEAK_SCORE).slice(0, 2);
    chosen = weak;
  }

  // Bridge-tag fallback: a concern whose tag exactly matches a Tier-3 signal but
  // produced no token signal still gets that signal at low confidence.
  if (chosen.length === 0) {
    const bridgeFallback = scores.filter((s) => s.bridgeExact).slice(0, 2);
    chosen = bridgeFallback.map((s) => ({ ...s, method: 'bridge_fallback' as MatchMethod }));
  }

  const mappedTokens = new Set<string>();
  for (const s of chosen) {
    const scoreConf = Math.min(1, s.score / 4);
    const methodFloor =
      s.method === 'bridge_exact' ? 0.8 :
      s.method === 'token_semantic' ? 0.7 :
      s.method === 'cluster_match' ? 0.55 :
      s.method === 'domain_category' ? 0.45 :
      0.3; // bridge_fallback
    const base = Math.max(scoreConf, methodFloor);
    const confidence = round4(Math.max(0, Math.min(1, 0.7 * base + 0.3 * s.def.confidence)));
    rows.push({
      ...baseRow,
      signal_tier: 'tier3',
      signal_ref: s.def.signal_id,
      signal_name: s.def.signal_name,
      domain: s.def.domain,
      match_method: s.method,
      score: round4(s.score),
      confidence,
      confidence_band: bandFor(confidence),
      severity_weight: round4(s.def.severity),
      metadata: {
        name_hits: s.nameHits, synonym_hits: s.synHits, hpc_hits: s.hpcHits,
        bridge_exact: s.bridgeExact, domain_match: s.domainMatch,
        ontology_confidence: round4(s.def.confidence), persistence: round4(s.def.persistence),
      },
    });
    mappedTokens.add(s.def.token);

    // Composite(s) inherited from this signal's HPC cluster (only when the cluster
    // genuinely forms a composite definition in the runtime).
    if (s.def.hpc_cluster && ontology.compositeKeys.has(s.def.hpc_cluster)) {
      const compConf = round4(confidence * 0.95);
      const exists = rows.find((r) => r.signal_tier === 'composite' && r.signal_ref === s.def.hpc_cluster);
      if (!exists) {
        rows.push({
          ...baseRow,
          signal_tier: 'composite',
          signal_ref: s.def.hpc_cluster,
          signal_name: s.def.hpc_cluster.replace(/_/g, ' '),
          domain: s.def.domain,
          match_method: 'composite_derived',
          score: round4(s.score),
          confidence: compConf,
          confidence_band: bandFor(compConf),
          severity_weight: round4(s.def.severity),
          metadata: { derived_from: s.def.signal_id, signal_token: s.def.token },
        });
      }
    }
  }

  // Atomic linkage at bridge-tag granularity. Prefer a specific (non-GENERAL)
  // bridge-tag match on the concern's own tag; otherwise fall back to
  // GENERAL_CONCERN as an explicitly weak link (honest about its coarseness).
  const specific = concernTag && concernTag !== 'GENERAL_CONCERN' ? ontology.atomicByTag.get(concernTag) : undefined;
  const atomicAgg = specific || ontology.atomicByTag.get('GENERAL_CONCERN');
  if (atomicAgg) {
    const isSpecific = atomicAgg.bridge_tag !== 'GENERAL_CONCERN';
    const method: MatchMethod = isSpecific ? 'atomic_bridge' : 'bridge_fallback';
    const confidence = round4(
      isSpecific
        ? Math.max(0, Math.min(1, 0.55 + 0.35 * atomicAgg.avg_confidence))
        : Math.max(0, Math.min(1, 0.3 * atomicAgg.avg_confidence)),
    );
    rows.push({
      ...baseRow,
      signal_tier: 'atomic',
      signal_ref: atomicAgg.bridge_tag,
      signal_name: `atomic:${atomicAgg.bridge_tag} (${atomicAgg.count} signals)`,
      domain: null,
      match_method: method,
      score: round4(atomicAgg.avg_severity),
      confidence,
      confidence_band: bandFor(confidence),
      severity_weight: round4(atomicAgg.avg_severity),
      metadata: {
        atomic_count: atomicAgg.count,
        sample_ids: atomicAgg.sample_ids,
        granularity: 'bridge_tag',
        avg_confidence: round4(atomicAgg.avg_confidence),
        avg_persistence: round4(atomicAgg.avg_persistence),
      },
    });
  }

  // Orphan: nothing resolved — flag explicitly, never fabricate.
  if (rows.filter((r) => r.signal_tier === 'tier3').length === 0) {
    rows.push({
      ...baseRow,
      signal_tier: 'orphan',
      signal_ref: '__orphan__',
      signal_name: null,
      domain: inferredCat,
      match_method: 'orphan',
      score: 0,
      confidence: 0,
      confidence_band: 'none',
      severity_weight: null,
      metadata: { reason: 'no Tier-3 signal resolved from token/bridge/domain cascade', inferred_category: inferredCat },
    });
  }

  return rows;
}

// ── Schema bootstrap (idempotent, lazy) ─────────────────────────────────────
let schemaPromise: Promise<void> | null = null;

/** Ensure `capadex_concern_signal_map` exists (mirrors the canonical migration). */
export function ensureConcernSignalMapSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_concern_signal_map (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        concern_pk            INTEGER NOT NULL,
        concern_id            TEXT,
        relational_bridge_tag TEXT,
        signal_tier           VARCHAR(16) NOT NULL,
        signal_ref            TEXT NOT NULL,
        signal_name           TEXT,
        domain                TEXT,
        match_method          VARCHAR(32) NOT NULL,
        score                 NUMERIC(8,4) NOT NULL DEFAULT 0,
        confidence            NUMERIC(5,4) NOT NULL DEFAULT 0,
        confidence_band       VARCHAR(12) NOT NULL DEFAULT 'weak',
        severity_weight       NUMERIC(5,4),
        metadata              JSONB NOT NULL DEFAULT '{}',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_concern_signal_map
        ON capadex_concern_signal_map (concern_pk, signal_tier, signal_ref);
      CREATE INDEX IF NOT EXISTS idx_concern_signal_map_concern ON capadex_concern_signal_map (concern_pk);
      CREATE INDEX IF NOT EXISTS idx_concern_signal_map_tier    ON capadex_concern_signal_map (signal_tier);
      CREATE INDEX IF NOT EXISTS idx_concern_signal_map_band    ON capadex_concern_signal_map (confidence_band);
      CREATE INDEX IF NOT EXISTS idx_concern_signal_map_method  ON capadex_concern_signal_map (match_method);
      CREATE INDEX IF NOT EXISTS idx_concern_signal_map_bridge  ON capadex_concern_signal_map (relational_bridge_tag);
    `)
    .then(() => undefined)
    .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

// ── Backfill orchestration (idempotent) ──────────────────────────────────────
export type BackfillMode = 'replace' | 'upsert' | 'append';

export interface BackfillStats {
  mode: BackfillMode;
  dry_run: boolean;
  concerns: number;
  mapped_concerns: number;
  orphan_concerns: number;
  rows_total: number;
  tier3_rows: number;
  atomic_rows: number;
  composite_rows: number;
  orphan_rows: number;
  weak_rows: number;
  by_band: Record<string, number>;
  by_method: Record<string, number>;
  duration_ms: number;
}

const CONCERN_SELECT = `
  SELECT id, concern_id, domain, concern_cluster, signal_cluster, root_cause_group,
         display_label, concern_category, intelligence_layer, assessment_dimension,
         intervention_lens, relational_bridge_tag
    FROM capadex_concerns_master ORDER BY id`;

/**
 * Run the mapping engine across all concerns and persist the result. Idempotent:
 * `replace` rebuilds the whole table inside a transaction; `upsert` overwrites
 * matching (concern, tier, ref) rows; `append` inserts only new ones. `dryRun`
 * computes the full stats without writing.
 */
export async function runConcernSignalMapping(
  pool: Pool,
  opts: { mode?: BackfillMode; dryRun?: boolean } = {},
): Promise<BackfillStats> {
  const mode = opts.mode || 'replace';
  const dryRun = !!opts.dryRun;
  const started = Date.now();

  await ensureConcernSignalMapSchema(pool);
  const ontology = await loadMappingOntology(pool);
  const concerns = (await pool.query<ConcernInput>(CONCERN_SELECT)).rows;

  const allRows: MappingRow[] = [];
  let mappedConcerns = 0;
  let orphanConcerns = 0;
  for (const c of concerns) {
    const rows = mapConcernToSignals(c, ontology);
    if (rows.some((r) => r.signal_tier === 'tier3')) mappedConcerns++;
    else orphanConcerns++;
    allRows.push(...rows);
  }

  const stats: BackfillStats = {
    mode, dry_run: dryRun,
    concerns: concerns.length,
    mapped_concerns: mappedConcerns,
    orphan_concerns: orphanConcerns,
    rows_total: allRows.length,
    tier3_rows: allRows.filter((r) => r.signal_tier === 'tier3').length,
    atomic_rows: allRows.filter((r) => r.signal_tier === 'atomic').length,
    composite_rows: allRows.filter((r) => r.signal_tier === 'composite').length,
    orphan_rows: allRows.filter((r) => r.signal_tier === 'orphan').length,
    weak_rows: allRows.filter((r) => r.confidence_band === 'weak').length,
    by_band: tally(allRows.map((r) => r.confidence_band)),
    by_method: tally(allRows.map((r) => r.match_method)),
    duration_ms: 0,
  };

  if (!dryRun) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (mode === 'replace') {
        await client.query('TRUNCATE capadex_concern_signal_map');
      }
      await insertRows(client, allRows, mode);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  stats.duration_ms = Date.now() - started;
  return stats;
}

function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] || 0) + 1;
  return out;
}

async function insertRows(client: PoolClient, rows: MappingRow[], mode: BackfillMode): Promise<void> {
  const CONFLICT =
    mode === 'append'
      ? 'ON CONFLICT (concern_pk, signal_tier, signal_ref) DO NOTHING'
      : `ON CONFLICT (concern_pk, signal_tier, signal_ref) DO UPDATE SET
           concern_id = EXCLUDED.concern_id,
           relational_bridge_tag = EXCLUDED.relational_bridge_tag,
           signal_name = EXCLUDED.signal_name,
           domain = EXCLUDED.domain,
           match_method = EXCLUDED.match_method,
           score = EXCLUDED.score,
           confidence = EXCLUDED.confidence,
           confidence_band = EXCLUDED.confidence_band,
           severity_weight = EXCLUDED.severity_weight,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`;

  const CHUNK = 150;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const tuples: string[] = [];
    chunk.forEach((r, j) => {
      const b = j * 13;
      tuples.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13}::jsonb)`,
      );
      values.push(
        r.concern_pk, r.concern_id, r.relational_bridge_tag, r.signal_tier, r.signal_ref,
        r.signal_name, r.domain, r.match_method, r.score, r.confidence, r.confidence_band,
        r.severity_weight,
      );
      values.push(JSON.stringify(r.metadata));
    });
    await client.query(
      `INSERT INTO capadex_concern_signal_map
         (concern_pk, concern_id, relational_bridge_tag, signal_tier, signal_ref,
          signal_name, domain, match_method, score, confidence, confidence_band, severity_weight, metadata)
       VALUES ${tuples.join(',')} ${CONFLICT}`,
      values,
    );
  }
}
