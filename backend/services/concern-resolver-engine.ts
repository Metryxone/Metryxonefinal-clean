// ─── CAPADEX Concern Resolver Engine (RRP-1) ─────────────────────────────────
// Pure, DB-free ranking core for resolving free-text user intent to a master
// concern_id. Extracted + repaired from the legacy SQL-ranked
// `resolveMasterConcernIdFromText`. Repairs (all additive to precision):
//   • IDF / rarity weighting — generic words ("work", "career", "stress") count
//     less than distinctive ones, so 444-way score ties collapse.
//   • Deterministic tie-break cascade — exact label → exact phrase → cluster →
//     bridge tag → specificity → age fit → concern_id (id is LAST resort, not
//     first), killing the content-blind alphabetical bias.
//   • Short-intent mode — for ≤3 tokens the ≥60% gate is replaced by exact
//     label/cluster/bridge boosts so "confidence" / "motivation" resolve.
//   • Resolution confidence (0-100) with explainable components incl. tie margin.
// Deterministic + never throws. The route owns DB/corpus loading + caching.

// ── Tokenization (single source — route + services import from here) ─────────
export const RESOLVER_STOPWORDS = new Set<string>([
  'i','im','am','my','me','we','our','you','your',
  'a','an','the','this','that','it','is','are','was','were',
  'have','has','had','will','would','can','and','or','but','of',
  'to','for','from','with','about','on','in','at','by','feel','feels','feeling',
  'very','really','quite','severe','severely','extreme','extremely',
  'bit','little','lot','lots','much','many','some','any','more','most',
]);

// Light suffix stemmer — collapses plural/tense variants to the base form stored
// in the corpus. Conservative: only strips when ≥4 chars remain.
export function stemConcernToken(t: string): string {
  const s = t.replace(/(?:ings?|edly|ed|ies|es|s|ly|ness|ment|tions?|ations?)$/i, (m) =>
    m === 'ies' ? 'y' : '');
  return s.length >= 4 ? s : t;
}

// Curated synonym groups (high-precision). A typed token expands to its semantic
// siblings. RRP-1 keeps the live set deliberately small; candidate expansions are
// produced as an audit deliverable, not auto-wired.
export const RESOLVER_SYNONYM_GROUPS: string[][] = [
  ['stress', 'anxiet', 'pressure', 'tension', 'overwhelm', 'worry', 'panic', 'nervous'],
  ['exam', 'test', 'assessment', 'viva', 'paper'],
  ['motiv', 'drive', 'procrastinat', 'lazy', 'discipline'],
  ['focus', 'concentrat', 'distract', 'attention'],
  ['career', 'job', 'work', 'profession', 'employ', 'placement', 'workplace'],
  ['confiden', 'doubt', 'insecur', 'esteem', 'worth'],
  ['sleep', 'insomnia', 'tired', 'fatigue', 'exhaust'],
  ['lonely', 'lonel', 'isolat', 'alone', 'withdraw'],
  ['anger', 'angry', 'irritab', 'frustrat', 'temper', 'rage'],
  ['sad', 'depress', 'hopeless', 'empty'],
  ['phone', 'screen', 'gaming', 'internet', 'addict', 'scroll'],
  ['relationship', 'friend', 'peer', 'bully'],
];
const RESOLVER_SYN_LOOKUP = new Map<string, string[]>();
for (const g of RESOLVER_SYNONYM_GROUPS) {
  for (const t of g) if (!RESOLVER_SYN_LOOKUP.has(t)) RESOLVER_SYN_LOOKUP.set(t, g);
}

// Expand one user token into the set of LIKE-stems it should match against: its
// own stem plus any curated synonym group it belongs to. The first element is
// always the token's own stem (the "direct" match; the rest are synonyms).
export function expandResolverToken(tok: string): { stem: string; patterns: string[] } {
  const stem = stemConcernToken(tok);
  const out = new Set<string>([stem]);
  const grp = RESOLVER_SYN_LOOKUP.get(stem) || RESOLVER_SYN_LOOKUP.get(tok);
  if (grp) grp.forEach((s) => out.add(s));
  return { stem, patterns: Array.from(out) };
}

export function tokenizeIntent(text: string): string[] {
  const q = String(text || '').toLowerCase().trim();
  if (q.length < 2) return [];
  return Array.from(new Set(
    q.replace(/[^a-z0-9\s/-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !RESOLVER_STOPWORDS.has(t)),
  )).slice(0, 6);
}

// ── Corpus + IDF ─────────────────────────────────────────────────────────────
export interface ConcernRowInput {
  concern_id: string;
  display_label?: string | null;
  concern_cluster?: string | null;
  concern_category?: string | null;
  common_indian_context?: string | null;
  domain?: string | null;
  relational_bridge_tag?: string | null;
  primary_persona?: string | null;
  age_min?: number | null;
  age_max?: number | null;
}

interface ConcernRow {
  concern_id: string;
  haystack: string;
  labelLower: string;
  clusterLower: string;
  categoryLower: string;
  tagWords: string;
  personaNorm: string;
  labelTokenCount: number;
  ageMin: number | null;
  ageMax: number | null;
}

export interface ResolverCorpus {
  rows: ConcernRow[];
  idf: Map<string, number>;
  maxIdf: number;
  N: number;
}

function normPersonaValue(p?: string | null): string {
  return String(p || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Build the in-memory corpus + a word-level IDF table. IDF uses document
// frequency of word *stems* across concern haystacks (an O(N) approximation of
// term rarity): idf = ln(N / (1 + df)). Substring matching still drives scoring;
// IDF only weights how much each matched token contributes.
export function buildResolverCorpus(input: ConcernRowInput[]): ResolverCorpus {
  const rows: ConcernRow[] = [];
  const df = new Map<string, number>();
  for (const c of input) {
    const label = (c.display_label || '').toLowerCase();
    const cluster = (c.concern_cluster || '').toLowerCase();
    const category = (c.concern_category || '').toLowerCase();
    const haystack = `${label} ${cluster} ${(c.common_indian_context || '').toLowerCase()} ${(c.domain || '').toLowerCase()}`.trim();
    const labelTokens = label.replace(/[^a-z0-9\s/-]/g, ' ').split(/\s+/).filter((t) => t.length >= 2 && !RESOLVER_STOPWORDS.has(t));
    rows.push({
      concern_id: c.concern_id,
      haystack,
      labelLower: label,
      clusterLower: cluster,
      categoryLower: category,
      tagWords: (c.relational_bridge_tag || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      personaNorm: normPersonaValue(c.primary_persona),
      labelTokenCount: Math.max(1, labelTokens.length),
      ageMin: c.age_min ?? null,
      ageMax: c.age_max ?? null,
    });
    // document frequency over distinct word-stems in the haystack
    const seen = new Set<string>();
    for (const w of haystack.replace(/[^a-z0-9\s/-]/g, ' ').split(/\s+/)) {
      if (w.length < 3 || RESOLVER_STOPWORDS.has(w)) continue;
      const st = stemConcernToken(w);
      if (st.length < 3 || seen.has(st)) continue;
      seen.add(st);
      df.set(st, (df.get(st) || 0) + 1);
    }
  }
  const N = rows.length || 1;
  const idf = new Map<string, number>();
  let maxIdf = 0;
  for (const [st, d] of df) {
    const v = Math.log(N / (1 + d));
    idf.set(st, v);
    if (v > maxIdf) maxIdf = v;
  }
  // Degenerate corpora (N<=1) make ln(N)<=0; clamp to a tiny positive floor so
  // specificity (avgIdf/maxIdf) can never produce NaN/Infinity.
  if (!(maxIdf > 0)) maxIdf = Math.max(Math.log(N), 1e-6);
  return { rows, idf, maxIdf, N };
}

// IDF weight for a token's stem. Unseen stems are treated as maximally rare.
function idfFor(corpus: ResolverCorpus, stem: string): number {
  const v = corpus.idf.get(stem);
  if (v == null) return corpus.maxIdf;
  // floor at a small positive so an extremely common term still contributes a
  // little (otherwise a sole-common-token match would score 0 and never resolve)
  return Math.max(0.05, v);
}

// ── Resolution ───────────────────────────────────────────────────────────────
export interface ResolutionComponents {
  label_match: number;
  cluster_match: number;
  bridge_tag_match: number;
  synonym_match: number;
  specificity_match: number;
  tie_margin: number;
}

export interface ResolutionResult {
  concern_id: string | null;
  raw_matched: number;
  weighted_matched: number;
  token_count: number;
  score_pct: number;
  short_intent: boolean;
  tie_count: number;             // candidates sharing the winning weighted score
  tie_break_reason: string;      // which cascade rung decided the winner
  confidence: number;            // 0-100
  components: ResolutionComponents;
  candidates_considered: number;
}

interface Scored {
  row: ConcernRow;
  raw: number;
  weighted: number;
  synHits: number;
  clusterHits: number;
  bridgeHits: number;
  matchedIdfs: number[];
  exactLabel: boolean;
  exactPhrase: boolean;
  ageFit: number;
  specificity: number;
}

const EPS = 1e-4;

export function resolveConcern(
  corpus: ResolverCorpus,
  text: string,
  personaCohort: string[] | null,
  ageRange: [number, number] | null,
): ResolutionResult {
  const empty: ResolutionResult = {
    concern_id: null, raw_matched: 0, weighted_matched: 0, token_count: 0, score_pct: 0,
    short_intent: false, tie_count: 0, tie_break_reason: 'no_tokens', confidence: 0,
    components: { label_match: 0, cluster_match: 0, bridge_tag_match: 0, synonym_match: 0, specificity_match: 0, tie_margin: 0 },
    candidates_considered: 0,
  };
  const tokens = tokenizeIntent(text);
  if (tokens.length === 0) return empty;
  const inputLower = String(text || '').toLowerCase();
  const short = tokens.length <= 3;
  const expansions = tokens.map(expandResolverToken);

  const hasAge = !!ageRange && Number.isFinite(ageRange[0]) && Number.isFinite(ageRange[1]);
  const bandMin = hasAge ? ageRange![0] : null;
  const bandMax = hasAge ? ageRange![1] : null;

  const scored: Scored[] = [];
  for (const row of corpus.rows) {
    if (personaCohort && !personaCohort.includes(row.personaNorm)) continue;
    let raw = 0, weighted = 0, synHits = 0, clusterHits = 0, bridgeHits = 0;
    const matchedIdfs: number[] = [];
    for (let ti = 0; ti < expansions.length; ti++) {
      const { stem, patterns } = expansions[ti];
      let hit = false, viaSynonym = false;
      for (const pat of patterns) {
        if (row.haystack.indexOf(pat) >= 0) { hit = true; if (pat !== stem) viaSynonym = true; else { viaSynonym = false; break; } }
      }
      if (!hit) continue;
      raw += 1;
      const w = idfFor(corpus, stem);
      weighted += w;
      matchedIdfs.push(w);
      if (viaSynonym) synHits += 1;
      if (row.clusterLower.indexOf(stem) >= 0) clusterHits += 1;
      if (row.tagWords && row.tagWords.indexOf(stem) >= 0) bridgeHits += 1;
    }
    if (raw === 0) continue;
    const exactLabel = row.labelLower.length >= 3 && inputLower.indexOf(row.labelLower) >= 0;
    const exactPhrase = (row.clusterLower.length >= 4 && inputLower.indexOf(row.clusterLower) >= 0)
      || (row.categoryLower.length >= 4 && inputLower.indexOf(row.categoryLower) >= 0);
    const ageFit = (bandMin != null && row.ageMin != null && row.ageMax != null && row.ageMin <= bandMax! && row.ageMax >= bandMin) ? 1 : 0;
    scored.push({
      row, raw, weighted, synHits, clusterHits, bridgeHits, matchedIdfs,
      exactLabel, exactPhrase, ageFit,
      specificity: weighted / row.labelTokenCount,
    });
  }

  if (scored.length === 0) {
    return { ...empty, token_count: tokens.length, short_intent: short, tie_break_reason: 'no_candidate', candidates_considered: 0 };
  }

  // Deterministic tie-break cascade (Phase 1). Primary signal is IDF-weighted
  // match (Phase 2); the cascade only decides among equal weighted scores.
  scored.sort((a, b) => {
    if (Math.abs(a.weighted - b.weighted) > EPS) return b.weighted - a.weighted;
    if (a.exactLabel !== b.exactLabel) return a.exactLabel ? -1 : 1;          // 1. exact label
    if (a.exactPhrase !== b.exactPhrase) return a.exactPhrase ? -1 : 1;        // 2. exact phrase
    if (a.clusterHits !== b.clusterHits) return b.clusterHits - a.clusterHits; // 3. cluster
    if (a.bridgeHits !== b.bridgeHits) return b.bridgeHits - a.bridgeHits;     // 4. bridge tag
    if (Math.abs(a.specificity - b.specificity) > EPS) return b.specificity - a.specificity; // 5. specificity
    if (a.ageFit !== b.ageFit) return b.ageFit - a.ageFit;                     // (age cohort)
    if (a.raw !== b.raw) return b.raw - a.raw;
    return a.row.concern_id < b.row.concern_id ? -1 : 1;                       // 6. concern_id (last resort)
  });

  const best = scored[0];
  const second = scored[1];
  // tie_count = candidates sharing the winning IDF-weighted score (pre-cascade)
  let tieCount = 0;
  for (const s of scored) { if (Math.abs(s.weighted - best.weighted) <= EPS) tieCount++; else break; }

  // why did the winner win over the runner-up (if a real tie existed)?
  let tieReason = 'unique_score';
  if (tieCount > 1 && second) {
    if (best.exactLabel !== second.exactLabel) tieReason = 'exact_label';
    else if (best.exactPhrase !== second.exactPhrase) tieReason = 'exact_phrase';
    else if (best.clusterHits !== second.clusterHits) tieReason = 'cluster_match';
    else if (best.bridgeHits !== second.bridgeHits) tieReason = 'bridge_tag_match';
    else if (Math.abs(best.specificity - second.specificity) > EPS) tieReason = 'specificity';
    else if (best.ageFit !== second.ageFit) tieReason = 'age_fit';
    else tieReason = 'concern_id_fallback';
  }

  const scorePct = (best.raw / tokens.length) * 100;
  // Acceptance: short-intent mode drops the 60% gate (Phase 3). Long intents keep
  // the ≥60% precision gate, but an exact label/phrase match always qualifies.
  const accepted = short
    ? (best.raw >= 1)
    : (scorePct >= 60 || best.exactLabel || best.exactPhrase);

  // ── Confidence (Phase 6) ──────────────────────────────────────────────────
  const n = tokens.length;
  const labelMatch = (() => { let c = 0; for (const e of expansions) if (best.row.labelLower.indexOf(e.stem) >= 0) c++; return c / n; })();
  const clusterMatch = best.clusterHits / n;
  const bridgeMatch = best.bridgeHits / n;
  const synonymMatch = best.synHits / n;
  const avgIdf = best.matchedIdfs.length ? best.matchedIdfs.reduce((s, v) => s + v, 0) / best.matchedIdfs.length : 0;
  const specificityMatch = corpus.maxIdf > 0 ? Math.min(1, avgIdf / corpus.maxIdf) : 0;
  const tieMargin = best.weighted > 0 && second
    ? Math.max(0, Math.min(1, (best.weighted - second.weighted) / best.weighted))
    : 1;
  const confidence = Math.round(100 * (
    0.25 * labelMatch + 0.12 * clusterMatch + 0.08 * bridgeMatch +
    0.10 * synonymMatch + 0.20 * specificityMatch + 0.25 * tieMargin
  ));

  return {
    concern_id: accepted ? best.row.concern_id : null,
    raw_matched: best.raw,
    weighted_matched: +best.weighted.toFixed(4),
    token_count: tokens.length,
    score_pct: Math.round(scorePct),
    short_intent: short,
    tie_count: tieCount,
    tie_break_reason: tieReason,
    confidence: accepted ? confidence : 0,
    components: {
      label_match: +labelMatch.toFixed(3),
      cluster_match: +clusterMatch.toFixed(3),
      bridge_tag_match: +bridgeMatch.toFixed(3),
      synonym_match: +synonymMatch.toFixed(3),
      specificity_match: +specificityMatch.toFixed(3),
      tie_margin: +tieMargin.toFixed(3),
    },
    candidates_considered: scored.length,
  };
}
