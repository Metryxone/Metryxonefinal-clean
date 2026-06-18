/**
 * CAPADEX WC-3 L5B — Question Context Intelligence (additive, reversible, pure).
 *
 * Phase 2 of L5 "Question Intelligence 2.0". Derives, for every clarity question, a
 * life-CONTEXT axis (Primary + Secondary context + a Context Confidence + an
 * `context_explicit` flag + a `relevance_risk` flag) using ONLY existing data: a
 * tightened, sense-disambiguated question lexicon (matched against the clarity row's own
 * `question` + `concern` text) corroborated by the joined concern ontology
 * (`capadex_concerns_master` via `master_bridge_tag = relational_bridge_tag`): its
 * `display_label`/`concern_search`/`common_indian_context` text and its `domain`.
 *
 * Grounded on the approved audit `backend/audit/wc-3/WC3_L5B_CONTEXT_INTELLIGENCE.md`.
 * Honesty contract (NEVER violated):
 *   - ~80% of the clarity bank is *legitimately* context-neutral. When no lexicon fires we
 *     stamp `GENERAL` — we NEVER force-tag a context onto a generic behavioural item.
 *   - Genuinely ambiguous rows (two contexts tie on the strongest evidence) are stamped
 *     `UNRESOLVED`, not arbitrarily picked.
 *   - The concern `domain` is a BOOSTER only: it can corroborate but can NEVER, by itself,
 *     tag a context (a clarity bridge tag joins to many concerns with many domains, so
 *     domain-alone tagging would smear). Tagging is always anchored to real lexicon text.
 *   - Two lexicons (LEADERSHIP, DIGITAL_BEHAVIOUR) are known to be noise-prone (audit §5:
 *     loose Leadership 2,803 → tight ≈1,154; Digital ~½ noise). They carry a transparent
 *     `relevance_risk` so over-counting is visible, never buried.
 *
 * This module NEVER authors or mutates question text, ontology, signals, or concerns, and
 * NEVER recomputes scores. Output persists to `wc3_question_context` (keyed by the clarity
 * SERIAL `id`, because clarity `question_id` is NOT unique). Nothing reads it at runtime, so
 * the app is byte-identical whether or not `wc3ContextIntel` is ON. Reversible via DROP TABLE.
 */
import type { Pool } from 'pg';
import { ensureWc3QuestionContextSchema } from './wc3-schema';

// --- Taxonomy (closed, version-stamped — audit §8) ------------------------------
export const CONTEXT_TAXONOMY_VERSION = 'L5B-v1';

/** Tier-1 audited contexts + Tier-2 candidates. Catch-alls GENERAL/UNRESOLVED are NOT
 *  nodes — they are honest outcomes assigned by the derivation logic. */
export const TIER1_CONTEXTS = [
  'AI_FUTURE_OF_WORK',
  'CAREER_TRANSITION',
  'PLACEMENT_ANXIETY',
  'FAMILY_PRESSURE',
  'COMPETITIVE_EXAM_PRESSURE',
  'ENTREPRENEURSHIP',
  'LEADERSHIP',
  'DIGITAL_BEHAVIOUR',
  'EMPLOYABILITY',
  'CAREER_CLARITY',
] as const;

export const TIER2_CONTEXTS = [
  'FINANCIAL_PRESSURE',
  'PEER_SOCIAL_COMPARISON',
  'RELOCATION_MIGRATION',
  'IDENTITY_BELONGING',
  'HIGHER_EDUCATION_CHOICE',
  'WORKPLACE_ADJUSTMENT',
] as const;

export type ContextKey =
  | (typeof TIER1_CONTEXTS)[number]
  | (typeof TIER2_CONTEXTS)[number]
  | 'GENERAL'
  | 'UNRESOLVED';

interface ContextNode {
  key: ContextKey;
  tier: 1 | 2;
  label: string;
  /** Known noise-prone lexicon (audit §5) → carries elevated relevance_risk. */
  noiseProne?: boolean;
  /** Tight, sense-disambiguated anchors (word-boundaried). Presence ⇒ explicit match. */
  tight: RegExp;
  /** Sense exclusions scrubbed from text BEFORE matching (e.g. Leadership "lead to"). */
  exclude?: RegExp;
  /** Corroborating concern-domain substrings (BOOSTER only — never tags alone). */
  domains?: string[];
}

type Score = { key: ContextKey; tier: 1 | 2; score: number; explicit: boolean; sources: number };

const W_QUESTION = 0.6; // clarity row's own question/concern wording (explicit)
const W_CONCERN = 0.3; // inherited from the bridge tag's `common_indian_context` (sparse, genuine)
const W_DOMAIN = 0.1; // domain corroboration (booster only — never tags or ties alone)

const BAND_HIGH = 0.6;
const BAND_MODERATE = 0.4;

/** Build a case-insensitive, global alternation regex with embedded word boundaries. */
function lex(...alts: string[]): RegExp {
  return new RegExp(alts.join('|'), 'gi');
}

const NODES: ContextNode[] = [
  {
    key: 'AI_FUTURE_OF_WORK', tier: 1, label: 'AI Job Disruption',
    tight: lex(
      'artificial intelligence', '\\bai\\b', 'machine learning', 'automation', 'automate[ds]?',
      '\\brobots?\\b', 'chatgpt', 'future of work', 'reskill\\w*', 'jobs?\\s+\\w*\\s*automat',
      'replaced by (a |the )?(machine|technology|ai|computer)', 'obsolete skill',
    ),
    domains: ['career growth', 'employability', 'career readiness'],
  },
  {
    key: 'CAREER_TRANSITION', tier: 1, label: 'Career Transition',
    tight: lex(
      'career (change|transition|switch|pivot|shift)', 'chang(e|ing) (my )?(career|field|stream|domain)',
      'switch(ing)? (my )?(career|field|stream|domain)', 'mid-?career', 're-?enter\\w* the workforce',
      'career break', 'new career', 'changing (my )?path',
    ),
    domains: ['career growth', 'workplace adaptation', 'career transition'],
  },
  {
    key: 'PLACEMENT_ANXIETY', tier: 1, label: 'Placement Anxiety',
    tight: lex(
      'placements?', 'campus (placement|recruitment|interview|drive)', '(job|campus|placement) interview',
      'interview (fear|anxiety|nervous\\w*|rejection|stress)', 'offer letter', 'job offer',
      'not get(ting)? placed', 'rejected (in|from|after) (the )?interview',
    ),
    domains: ['career readiness', 'employability', 'placement'],
  },
  {
    key: 'FAMILY_PRESSURE', tier: 1, label: 'Family Pressure',
    tight: lex(
      'family (pressure|expectation\\w*)', 'parent(s|al)? (pressure|expect\\w*|want|force|forcing|disappoint\\w*)',
      'my (parents|father|mother|family) (want|expect|force|pressur\\w*)', 'pressure from (my )?(family|parents)',
      'disappoint\\w* my (parents|family)', 'stream (imposed|forced) by',
    ),
    domains: ['lifestyle & pressure environment', 'family', 'pressure'],
  },
  {
    key: 'COMPETITIVE_EXAM_PRESSURE', tier: 1, label: 'Competitive Exam Pressure',
    tight: lex(
      'competitive exam\\w*', 'entrance exam\\w*', '\\bneet\\b', '\\bjee\\b', '\\bupsc\\b', 'board exam\\w*',
      'rank pressure', 'coaching (institute|class\\w*|centre|center)', 'cut-?off\\w*',
      '(exam )?attempts? (for|at) (the )?exam', 'exam (fatigue|attempt)',
    ),
    domains: ['examination stress & emotional regulation', 'examination readiness', 'exam'],
  },
  {
    key: 'ENTREPRENEURSHIP', tier: 1, label: 'Entrepreneurship',
    tight: lex(
      'entrepreneur\\w*', 'start-?ups?', 'start (my|a) (own )?(business|company|venture)',
      'found(er|ing)? (a |my )?(company|startup|business)', 'my own business', 'self-employ\\w*',
      'launch (a |my )?(venture|business|startup)',
    ),
    domains: ['career growth', 'holistic development'],
  },
  {
    key: 'LEADERSHIP', tier: 1, label: 'Leadership', noiseProne: true,
    tight: lex(
      'leadership', '\\bleaders?\\b', 'team lead\\w*', 'lead(ing)? (a|the|my) team', 'delegat\\w*',
      'take charge', 'lead(ing)? others', 'manag(e|ing|er) (a|my|the) team', 'take ownership',
      'influenc\\w* (others|people|the team|my team)', 'mentor(ing)? (others|juniors|the team)',
    ),
    exclude: lex('lead(s|ing)? to', '(could|can|may|would|might|will) lead', 'leading (cause|to)'),
    domains: ['leadership & ownership', 'collaboration & ownership', 'leadership'],
  },
  {
    key: 'DIGITAL_BEHAVIOUR', tier: 1, label: 'Digital Behaviour', noiseProne: true,
    tight: lex(
      'social media', 'screen[- ]?time', 'smartphones?', 'scrolling', '\\bgaming\\b', 'online gam\\w*',
      'instagram|facebook|youtube|tiktok|snapchat', 'phone addiction', 'internet addiction',
      'digital (distraction\\w*|detox|addiction)', 'online comparison', 'screen (addiction|overuse)',
    ),
    domains: ['lifestyle & pressure environment', 'digital'],
  },
  {
    key: 'EMPLOYABILITY', tier: 1, label: 'Employability',
    tight: lex(
      'employab\\w*', 'employable', 'job-?ready', 'work-?ready', 'skill ?gaps?', 'industry (ready|readiness|relevant)',
      'marketable skill\\w*', 'hireab\\w*', 'land (a |the )?job', 'workplace readiness',
    ),
    domains: ['employability', 'career readiness', 'competency development'],
  },
  {
    key: 'CAREER_CLARITY', tier: 1, label: 'Career Clarity',
    tight: lex(
      'career (clarity|direction|confusion|path|goal\\w*)', '(don.?t|do not) know (what|which) (career|to do|field|stream)',
      'confused about (my )?(career|future|path)', 'unclear (career|direction|future)',
      'which (career|field|stream) (to|should)', 'figure out (my )?career', 'too many (career )?options',
      'option overload',
    ),
    domains: ['career growth', 'career readiness', 'holistic development'],
  },
  // --- Tier-2 (conservative tight-only; un-audited for noise → kept strict) -------
  {
    key: 'FINANCIAL_PRESSURE', tier: 2, label: 'Financial Pressure',
    tight: lex(
      'financial (pressure|stress|burden|problem\\w*|difficult\\w*)', 'money problem\\w*',
      'afford(ing)? (college|fees|education|tuition)', 'cannot afford', 'education loan', 'fees pressure',
    ),
    domains: ['lifestyle & pressure environment'],
  },
  {
    key: 'PEER_SOCIAL_COMPARISON', tier: 2, label: 'Peer / Social Comparison',
    tight: lex(
      'compar\\w* (myself )?(to|with) (peers|friends|others|classmates|everyone)', 'peer pressure',
      'social comparison', 'friends are (ahead|doing better)', '\\bfomo\\b', 'fear of missing out',
    ),
    domains: ['confidence, self-concept & comparison', 'social & emotional intelligence'],
  },
  {
    key: 'RELOCATION_MIGRATION', tier: 2, label: 'Relocation / Migration',
    tight: lex(
      'relocat\\w*', 'mov(e|ing) (to|abroad|away|cities|to a new city)', 'migrat\\w*', 'study abroad',
      'settl\\w* abroad', 'away from home', 'new city',
    ),
    domains: ['adjustment & coping capacity'],
  },
  {
    key: 'IDENTITY_BELONGING', tier: 2, label: 'Identity / Belonging',
    tight: lex(
      'sense of belonging', 'self-identity', 'who (am i|i am)', 'fit in\\b', 'do(n.?t| not) belong',
      'acceptance by',
    ),
    domains: ['academic identity & meaning', 'confidence, self-concept & comparison'],
  },
  {
    key: 'HIGHER_EDUCATION_CHOICE', tier: 2, label: 'Higher Education Choice',
    tight: lex(
      'higher (studies|education)', 'masters?\\b', 'post-?graduat\\w*', '\\bmba\\b', '\\bpg\\b',
      'which (college|course|degree)', '(course|stream) selection', 'study further',
    ),
    domains: ['academic identity & meaning', 'strategic preparation'],
  },
  {
    key: 'WORKPLACE_ADJUSTMENT', tier: 2, label: 'Workplace Adjustment',
    tight: lex(
      'workplace (adjust\\w*|adapt\\w*|culture)', 'adjust(ing)? to (the )?workplace', 'first job',
      'office (culture|politics)', 'corporate (culture|life)', 'new job (adjust\\w*|adapt\\w*)',
    ),
    domains: ['workplace adaptation', 'collaboration & ownership'],
  },
];

const NODE_BY_KEY = new Map<ContextKey, ContextNode>(NODES.map((n) => [n.key, n]));

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase();
}

/** Remove sense-excluded spans before counting tight matches. */
function scrub(text: string, exclude?: RegExp): string {
  if (!exclude) return text;
  return text.replace(new RegExp(exclude.source, 'gi'), ' ');
}

function countHits(re: RegExp, text: string): number {
  if (!text) return 0;
  const m = text.match(new RegExp(re.source, 'gi'));
  return m ? m.length : 0;
}

export type ContextBand = 'HIGH_CONFIDENCE' | 'MODERATE_CONFIDENCE' | 'LOW_CONFIDENCE' | 'UNRESOLVED' | 'GENERAL';
export type RelevanceRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface QuestionContextInput {
  /** The clarity row's own question + concern text (explicit, question-side). */
  question_text?: string | null;
  /** Inherited ontology text aggregated over the bridge tag's concerns. */
  concern_text?: string | null;
  /** Concern domains aggregated over the bridge tag (lowercased). Booster only. */
  concern_domains?: string[];
}

export interface QuestionContextResult {
  primary_context: ContextKey;
  secondary_context: ContextKey | null;
  context_confidence: number; // 0..1
  context_band: ContextBand;
  context_explicit: boolean; // lexicon-anchored in the question itself
  relevance_risk: RelevanceRisk;
  coverage: number; // 0..1 — fraction of evidence sources (question/concern/domain) that fired
  context_distribution: Record<string, number>;
  signals_used: {
    matched_contexts: string[];
    question_hits: Record<string, number>;
    concern_hits: Record<string, number>;
    domain_hits: string[];
  };
}

/**
 * Pure derivation: score every taxonomy node from the three evidence sources, pick a
 * Primary/Secondary context + a confidence/band, and emit an honest GENERAL / UNRESOLVED
 * when warranted. Deterministic; no DB, no side effects.
 */
export function deriveQuestionContext(input: QuestionContextInput): QuestionContextResult {
  const qText = norm(input.question_text);
  const cText = norm(input.concern_text);
  const domains = (input.concern_domains ?? []).map(norm);

  const scores: Score[] = [];
  const questionHits: Record<string, number> = {};
  const concernHits: Record<string, number> = {};
  const domainHits: string[] = [];

  for (const node of NODES) {
    const qh = countHits(node.tight, scrub(qText, node.exclude));
    const ch = countHits(node.tight, scrub(cText, node.exclude));
    // Domain is a BOOSTER only — never tags alone.
    const dHit = (node.domains ?? []).some((d) => domains.some((dom) => dom.includes(d)));
    const baseFired = qh > 0 || ch > 0;
    if (!baseFired) continue;

    if (qh > 0) questionHits[node.key] = qh;
    if (ch > 0) concernHits[node.key] = ch;
    if (dHit) domainHits.push(node.key);

    let score = 0;
    let sources = 0;
    if (qh > 0) { score += W_QUESTION; sources += 1; }
    if (ch > 0) { score += W_CONCERN; sources += 1; }
    if (dHit) { score += W_DOMAIN; sources += 1; }
    score = Math.min(1, score);
    scores.push({ key: node.key, tier: node.tier, score, explicit: qh > 0, sources });
  }

  const signals_used = {
    matched_contexts: scores.map((s) => s.key),
    question_hits: questionHits,
    concern_hits: concernHits,
    domain_hits: domainHits,
  };

  // No lexicon fired anywhere → legitimately context-neutral. NEVER force-tag.
  if (scores.length === 0) {
    return {
      primary_context: 'GENERAL', secondary_context: null, context_confidence: 0,
      context_band: 'GENERAL', context_explicit: false, relevance_risk: 'NONE',
      coverage: 0, context_distribution: {}, signals_used,
    };
  }

  // Deterministic ranking: score desc, then EXPLICIT (question-anchored) before inherited,
  // then Tier-1 before Tier-2, then key asc.
  const cmp = (a: Score, b: Score) =>
    b.score - a.score
    || (Number(b.explicit) - Number(a.explicit))
    || a.tier - b.tier
    || (a.key < b.key ? -1 : 1);
  scores.sort(cmp);

  const total = scores.reduce((s, x) => s + x.score, 0) || 1;
  const context_distribution: Record<string, number> = {};
  for (const s of scores) context_distribution[s.key] = round(s.score / total, 4);

  // Two-stage resolution to keep UNRESOLVED meaningful and avoid inherited "smear":
  //   (1) EXPLICIT (question-anchored) contexts decide the tag. A genuine tie between two
  //       explicit contexts → UNRESOLVED (the question itself invokes 2+ contexts equally;
  //       ~1% per audit).
  //   (2) Only when NO explicit context fired do we consider INHERITED contexts (from the
  //       bridge tag's sparse common_indian_context). Inherited tagging is allowed ONLY when
  //       it points to exactly ONE context — a single clean attribution. Inherited
  //       multi-match is bridge-tag aggregation smear, not genuine question ambiguity, so we
  //       decline to tag (→ GENERAL) rather than fabricate a primary or a false tie.
  const explicit = scores.filter((s) => s.explicit);
  const inherited = scores.filter((s) => !s.explicit);

  let chosen: Score | null = null;
  if (explicit.length > 0) {
    const top = explicit[0];
    const runnerUp = explicit[1] ?? null;
    // Any genuine explicit score tie is ambiguity — regardless of tier. We do NOT let the
    // Tier-1-before-Tier-2 tiebreak fabricate a primary when two contexts are equally
    // evidenced in the question text. (Tier only orders display/secondary, never a tie.)
    const explicitTie = !!runnerUp && Math.abs(runnerUp.score - top.score) < 1e-9;
    if (explicitTie) {
      return {
        primary_context: 'UNRESOLVED',
        secondary_context: top.key, // surface one tied candidate for transparency
        context_confidence: round(top.score * 0.5, 3),
        context_band: 'UNRESOLVED', context_explicit: true,
        relevance_risk: 'NONE', coverage: round(top.sources / 3, 3),
        context_distribution, signals_used,
      };
    }
    chosen = top;
  } else if (inherited.length === 1) {
    chosen = inherited[0]; // single clean inherited attribution
  }

  // No explicit match and inherited is absent or ambiguous (≥2) → honest GENERAL.
  if (!chosen) {
    return {
      primary_context: 'GENERAL', secondary_context: null, context_confidence: 0,
      context_band: 'GENERAL', context_explicit: false, relevance_risk: 'NONE',
      coverage: 0, context_distribution, signals_used,
    };
  }

  const top = chosen;
  // Secondary = next-best DIFFERENT context overall (explicit or inherited), for transparency.
  const second = scores.find((s) => s.key !== top.key && s.score > 0) ?? null;

  const corroboration = top.sources / 3;
  const context_confidence = round(top.score * (0.7 + 0.3 * corroboration), 3);
  const context_band: ContextBand =
    context_confidence >= BAND_HIGH ? 'HIGH_CONFIDENCE'
    : context_confidence >= BAND_MODERATE ? 'MODERATE_CONFIDENCE'
    : 'LOW_CONFIDENCE';

  const node = NODE_BY_KEY.get(top.key);
  const relevance_risk: RelevanceRisk = node?.noiseProne
    ? (top.sources === 1 && top.explicit ? 'HIGH' : 'MEDIUM')
    : (top.sources >= 2 ? 'NONE' : 'LOW');

  return {
    primary_context: top.key,
    secondary_context: second ? second.key : null,
    context_confidence, context_band,
    context_explicit: top.explicit,
    relevance_risk,
    coverage: round(top.sources / 3, 3),
    context_distribution, signals_used,
  };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// --- Batch builder --------------------------------------------------------------

export interface BuildContextReport {
  total: number;
  written: number;
  resolved: number; // primary ∉ {GENERAL, UNRESOLVED}
  general_count: number;
  unresolved_count: number;
  explicit_count: number;
  coverage_pct: number; // resolved / total
  context_distribution: Record<string, number>;
  band_distribution: Record<string, number>;
  relevance_risk_distribution: Record<string, number>;
  mean_confidence_resolved: number;
  confidence_histogram: Record<string, number>;
  qis_context_delta: number;
}

interface BridgeAgg { ctext: string; domains: string[]; }

/** Load bridge-tag → aggregated concern text + domains (one query). */
async function loadBridgeMap(pool: Pool): Promise<Map<string, BridgeAgg>> {
  // Corroboration text is the genuine, sparse `common_indian_context` ONLY. We deliberately
  // EXCLUDE display_label/concern_search: those are broad behavioural descriptors and, when
  // aggregated over a bridge tag (one tag → many concerns), they form a blob that matches
  // many lexicons at once — the exact "ambient smear" the L5B audit warned about. domain
  // stays a booster array (never tags alone).
  const { rows } = await pool.query<{ tag: string; ctext: string | null; domains: string[] | null }>(
    `SELECT relational_bridge_tag AS tag,
            lower(string_agg(DISTINCT coalesce(common_indian_context,''), ' ')) AS ctext,
            array_agg(DISTINCT lower(coalesce(domain,''))) AS domains
       FROM capadex_concerns_master
      WHERE relational_bridge_tag IS NOT NULL AND btrim(relational_bridge_tag) <> ''
      GROUP BY relational_bridge_tag`,
  );
  const map = new Map<string, BridgeAgg>();
  for (const r of rows) {
    map.set(r.tag, { ctext: r.ctext ?? '', domains: (r.domains ?? []).filter(Boolean) });
  }
  return map;
}

/**
 * Batch builder: derive context intelligence for EVERY clarity question and upsert into
 * `wc3_question_context`. Idempotent (ON CONFLICT (clarity_id) DO UPDATE). Returns the
 * validation metrics required by the L5B deltas report.
 */
export async function buildQuestionContextIntelligence(pool: Pool): Promise<BuildContextReport> {
  await ensureWc3QuestionContextSchema(pool);
  const bridgeMap = await loadBridgeMap(pool);

  const { rows } = await pool.query<{
    id: number;
    question_id: string | null;
    master_bridge_tag: string | null;
    question: string | null;
    concern: string | null;
  }>(
    `SELECT id, question_id, master_bridge_tag, question, concern FROM capadex_clarity_questions`,
  );

  const total = rows.length;
  let written = 0;
  let resolved = 0;
  let general = 0;
  let unresolved = 0;
  let explicit = 0;
  let confSumResolved = 0;
  const ctxDist: Record<string, number> = {};
  const bandDist: Record<string, number> = {};
  const riskDist: Record<string, number> = {};
  const histo: Record<string, number> = { '0.0-0.3': 0, '0.3-0.4': 0, '0.4-0.6': 0, '0.6-0.8': 0, '0.8-1.0': 0 };

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values: any[] = [];
    const tuples: string[] = [];
    slice.forEach((r, j) => {
      const agg = r.master_bridge_tag ? bridgeMap.get(r.master_bridge_tag) : undefined;
      const d = deriveQuestionContext({
        question_text: `${r.question ?? ''} ${r.concern ?? ''}`,
        concern_text: agg?.ctext ?? '',
        concern_domains: agg?.domains ?? [],
      });

      ctxDist[d.primary_context] = (ctxDist[d.primary_context] ?? 0) + 1;
      bandDist[d.context_band] = (bandDist[d.context_band] ?? 0) + 1;
      riskDist[d.relevance_risk] = (riskDist[d.relevance_risk] ?? 0) + 1;
      if (d.context_explicit) explicit += 1;
      if (d.primary_context === 'GENERAL') general += 1;
      else if (d.primary_context === 'UNRESOLVED') unresolved += 1;
      else { resolved += 1; confSumResolved += d.context_confidence; }

      const c = d.context_confidence;
      const bucket = c < 0.3 ? '0.0-0.3' : c < 0.4 ? '0.3-0.4' : c < 0.6 ? '0.4-0.6' : c < 0.8 ? '0.6-0.8' : '0.8-1.0';
      histo[bucket] += 1;

      const b = j * 11;
      tuples.push(
        `($${b + 1},$${b + 2},'clarity',$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},now())`,
      );
      values.push(
        r.id, r.question_id ?? null, d.primary_context, d.secondary_context,
        d.context_confidence, d.context_band, d.context_explicit, d.relevance_risk, d.coverage,
        JSON.stringify(d.context_distribution), JSON.stringify(d.signals_used),
      );
    });
    await pool.query(
      `INSERT INTO wc3_question_context
         (clarity_id, question_id, source, primary_context, secondary_context,
          context_confidence, context_band, context_explicit, relevance_risk, coverage,
          context_distribution, signals_used, computed_at)
       VALUES ${tuples.join(',')}
       ON CONFLICT (clarity_id) DO UPDATE SET
         question_id = EXCLUDED.question_id,
         primary_context = EXCLUDED.primary_context,
         secondary_context = EXCLUDED.secondary_context,
         context_confidence = EXCLUDED.context_confidence,
         context_band = EXCLUDED.context_band,
         context_explicit = EXCLUDED.context_explicit,
         relevance_risk = EXCLUDED.relevance_risk,
         coverage = EXCLUDED.coverage,
         context_distribution = EXCLUDED.context_distribution,
         signals_used = EXCLUDED.signals_used,
         computed_at = now()`,
      values,
    );
    written += slice.length;
  }

  const mean_confidence_resolved = resolved > 0 ? round(confSumResolved / resolved, 3) : 0;
  const coverage_pct = total > 0 ? round((100 * resolved) / total, 1) : 0;
  // QIS Context dimension weight = 0.10 (WC3_L5_QUESTION_INTELLIGENCE.md §1.4).
  // Honest contribution = weight × resolved-fraction × mean confidence × 100. Bounded by
  // the ~80% legitimately-neutral mass — never inflated.
  const qis_context_delta = round(0.1 * (resolved / Math.max(total, 1)) * mean_confidence_resolved * 100, 2);

  return {
    total, written, resolved, general_count: general, unresolved_count: unresolved,
    explicit_count: explicit, coverage_pct,
    context_distribution: ctxDist, band_distribution: bandDist,
    relevance_risk_distribution: riskDist, mean_confidence_resolved,
    confidence_histogram: histo, qis_context_delta,
  };
}

// --- Read-only metric services (productize the audit; query the persisted sidecar) ---

export interface ContextMetrics {
  taxonomy_version: string;
  total: number;
  coverage: Array<{ context: string; matched: number; pct: number; explicit: number }>;
  ambiguity: { general: number; unresolved: number; resolved: number; explicit_pct: number };
  relevance_risk: Record<string, number>;
  bands: Record<string, number>;
  top_gaps: Array<{ context: string; matched: number; pct: number }>;
  mean_confidence_resolved: number;
}

/**
 * Read-only metrics over the persisted `wc3_question_context` table (Coverage, Ambiguity,
 * Relevance Risk, Bands, Top-N gaps). Never recomputes derivation; purely aggregates what
 * the builder stored. `top_n` controls the gap list size.
 */
export async function getContextMetrics(pool: Pool, topN = 10): Promise<ContextMetrics | null> {
  // Read-only: do NOT ensure/auto-create the table here. The sidecar is built offline by
  // the builder script. If the table is absent OR empty, the index has not been built →
  // return null so the route emits the honest degraded envelope (never a zeroed metric).
  const existsRes = await pool.query<{ reg: string | null }>(
    `SELECT to_regclass('public.wc3_question_context')::text AS reg`,
  );
  if (!existsRes.rows[0]?.reg) return null;

  const totalRes = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM wc3_question_context`);
  const total = Number(totalRes.rows[0]?.n ?? 0);
  if (total === 0) return null;

  const cov = await pool.query<{ primary_context: string; matched: string; explicit: string }>(
    `SELECT primary_context,
            count(*)::text AS matched,
            count(*) FILTER (WHERE context_explicit)::text AS explicit
       FROM wc3_question_context
      GROUP BY primary_context`,
  );
  const coverage = cov.rows.map((r) => ({
    context: r.primary_context,
    matched: Number(r.matched),
    pct: total > 0 ? round((100 * Number(r.matched)) / total, 2) : 0,
    explicit: Number(r.explicit),
  })).sort((a, b) => b.matched - a.matched);

  const general = coverage.find((c) => c.context === 'GENERAL')?.matched ?? 0;
  const unresolved = coverage.find((c) => c.context === 'UNRESOLVED')?.matched ?? 0;
  const resolved = total - general - unresolved;

  const riskRes = await pool.query<{ relevance_risk: string; n: string }>(
    `SELECT relevance_risk, count(*)::text AS n FROM wc3_question_context GROUP BY relevance_risk`,
  );
  const relevance_risk: Record<string, number> = {};
  for (const r of riskRes.rows) relevance_risk[r.relevance_risk] = Number(r.n);

  const bandRes = await pool.query<{ context_band: string; n: string }>(
    `SELECT context_band, count(*)::text AS n FROM wc3_question_context GROUP BY context_band`,
  );
  const bands: Record<string, number> = {};
  for (const r of bandRes.rows) bands[r.context_band] = Number(r.n);

  const explicitRes = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM wc3_question_context WHERE context_explicit`,
  );
  const explicitCount = Number(explicitRes.rows[0]?.n ?? 0);

  const confRes = await pool.query<{ avg: string | null }>(
    `SELECT avg(context_confidence)::text AS avg FROM wc3_question_context
      WHERE primary_context NOT IN ('GENERAL','UNRESOLVED')`,
  );
  const mean_confidence_resolved = confRes.rows[0]?.avg ? round(Number(confRes.rows[0].avg), 3) : 0;

  // Top gaps = the canonical contexts with the LOWEST coverage (authoring backlog).
  const matchedByCtx = new Map(coverage.map((c) => [c.context, c.matched]));
  const top_gaps = [...TIER1_CONTEXTS]
    .map((ctx) => {
      const matched = matchedByCtx.get(ctx) ?? 0;
      return { context: ctx, matched, pct: total > 0 ? round((100 * matched) / total, 2) : 0 };
    })
    .sort((a, b) => a.matched - b.matched)
    .slice(0, topN);

  return {
    taxonomy_version: CONTEXT_TAXONOMY_VERSION,
    total,
    coverage,
    ambiguity: {
      general, unresolved, resolved,
      explicit_pct: total > 0 ? round((100 * explicitCount) / total, 2) : 0,
    },
    relevance_risk, bands, top_gaps,
    mean_confidence_resolved,
  };
}
