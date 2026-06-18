/**
 * Evidence Extraction Pipeline — Phase 2.
 *
 * Pure-function pattern matcher. Walks a list of `EvidenceSource` objects
 * (text + provenance), applies the regex patterns from the behavioural-signal
 * taxonomy, and emits an `EvidenceHit[]` per matched signal.
 *
 *   Sources covered: interview transcripts · simulations · resume narratives
 *                    project descriptions · goals · profile summaries
 *                    job tracker notes
 *
 * Designed to be deterministic and dependency-free so it can be unit-tested
 * and run on any text payload without a model in the loop.
 */

import { SIGNAL_TAXONOMY, scoreSignal,
         type EvidenceHit, type EvidenceSourceType,
         type SignalKey, type SignalScore } from './behavioral-signal-engine.js';

export interface EvidenceSource {
  source_type: EvidenceSourceType;
  source_id: string;
  text: string;
  /** ISO date (or omit → now). */
  occurred_at?: string;
}

const NUMERIC_RE   = /(\d+(\.\d+)?)\s?(%|x|k|cr|lakh|crore|million|bn|rs\.?|\$|usd|inr)?/i;
const HEDGE_RE     = /\b(i think|i guess|maybe|sort of|kind of|probably|might|perhaps)\b/i;
const SNIPPET_PAD  = 80;

/**
 * Carve out a ≤ 240-char snippet around the match for UI provenance.
 */
function carveSnippet(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - SNIPPET_PAD);
  const end   = Math.min(text.length, idx + len + SNIPPET_PAD);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return (prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix).slice(0, 240);
}

/**
 * Find all non-overlapping matches of `re` inside `text`.
 * Returns indices + match length.
 */
function findAll(text: string, re: RegExp): Array<{ idx: number; len: number }> {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const r = new RegExp(re.source, flags);
  const out: Array<{ idx: number; len: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[0].length === 0) { r.lastIndex++; continue; }   // safety: zero-width
    out.push({ idx: m.index, len: m[0].length });
    if (out.length > 50) break;                            // hard cap
  }
  return out;
}

/**
 * Extract `EvidenceHit[]` for a single source. Multiple signals can match the
 * same source. Match strength rises with quantitative cues and falls in the
 * neighbourhood of hedging language.
 */
export function extractFromSource(src: EvidenceSource): EvidenceHit[] {
  const out: EvidenceHit[] = [];
  if (!src.text || typeof src.text !== 'string') return out;
  const text = src.text;
  const occurred_at = src.occurred_at ?? new Date().toISOString();

  for (const def of SIGNAL_TAXONOMY) {
    const matchesByPattern = def.patterns.flatMap(p => findAll(text, p));
    if (matchesByPattern.length === 0) continue;

    // Cap per-signal hits per source to keep evidence diverse across sources
    const capped = matchesByPattern.slice(0, 3);

    for (const m of capped) {
      const snippet = carveSnippet(text, m.idx, m.len);

      // Base strength
      let strength = 0.55;

      // Quantitative cue bonus
      if (def.expects_quantifier && NUMERIC_RE.test(snippet)) strength += 0.20;
      else if (NUMERIC_RE.test(snippet))                      strength += 0.08;

      // Hedge penalty inside the same snippet
      if (HEDGE_RE.test(snippet)) strength -= 0.15;

      // Negative-pattern penalty
      if (def.negative_patterns?.some(np => np.test(snippet))) strength -= 0.15;

      // Multiple-match bonus (capped)
      if (capped.length > 1) strength += 0.05;

      strength = Math.max(0.1, Math.min(0.98, strength));

      out.push({
        signal_key:    def.key as SignalKey,
        source_type:   src.source_type,
        source_id:     src.source_id,
        snippet,
        occurred_at,
        match_strength: round3(strength),
      });
    }
  }
  return out;
}

/**
 * Run extraction over all sources and emit a SignalScore for every signal
 * that received at least one hit (signals with zero evidence are omitted).
 */
export function extractAndScore(sources: EvidenceSource[], now: Date = new Date()):
  { hits: EvidenceHit[]; scores: SignalScore[] } {
  const allHits = sources.flatMap(extractFromSource);

  const byKey = new Map<SignalKey, EvidenceHit[]>();
  for (const h of allHits) {
    const arr = byKey.get(h.signal_key) ?? [];
    arr.push(h);
    byKey.set(h.signal_key, arr);
  }

  const scores: SignalScore[] = [];
  for (const [key, hits] of byKey) scores.push(scoreSignal(key, hits, now));

  // Sort by behavioural_strength descending so consumers see strongest first
  scores.sort((a, b) => b.behavioural_strength - a.behavioural_strength);
  return { hits: allHits, scores };
}

/**
 * Convenience builder: turn a `career_seeker_profiles.data` JSONB + jobs[] +
 * goals[] into a normalised `EvidenceSource[]` for extraction. Defensive
 * about missing fields so it works on partial profiles.
 */
export function buildSourcesFromProfile(args: {
  user_id: string;
  profile?: Record<string, unknown> | null;
  jobs?: Array<Record<string, unknown>>;
  goals?: Array<Record<string, unknown>>;
  transcripts?: Array<{ id?: string; text: string; occurred_at?: string }>;
  simulations?: Array<{ id?: string; text: string; occurred_at?: string }>;
}): EvidenceSource[] {
  const out: EvidenceSource[] = [];
  const p = (args.profile ?? {}) as Record<string, unknown>;

  // profile summary
  if (typeof p.summary === 'string' && p.summary.trim()) {
    out.push({ source_type: 'profile_summary', source_id: args.user_id, text: p.summary });
  }
  // resume narratives — flatten experience[] descriptions
  if (Array.isArray(p.experience)) {
    for (const e of p.experience as Array<Record<string, unknown>>) {
      const text = [e?.title, e?.company, e?.description, e?.summary]
        .filter(v => typeof v === 'string').join('. ');
      if (text.trim()) {
        out.push({
          source_type: 'resume',
          source_id: String(e?.id ?? e?.company ?? 'exp'),
          text,
          occurred_at: typeof e?.endDate === 'string' ? e.endDate as string : undefined,
        });
      }
    }
  }
  // project descriptions
  if (Array.isArray(p.projects)) {
    for (const proj of p.projects as Array<Record<string, unknown>>) {
      const text = [proj?.title, proj?.description, proj?.impact, proj?.outcome]
        .filter(v => typeof v === 'string').join('. ');
      if (text.trim()) {
        out.push({
          source_type: 'project_description',
          source_id: String(proj?.id ?? proj?.title ?? 'proj'),
          text,
          occurred_at: typeof proj?.endDate === 'string' ? proj.endDate as string : undefined,
        });
      }
    }
  }
  // goals
  for (const g of args.goals ?? []) {
    const text = [g?.title, g?.description, g?.notes].filter(v => typeof v === 'string').join('. ');
    if (text.trim()) {
      out.push({ source_type: 'goal', source_id: String(g?._id ?? g?.id ?? ''), text,
                 occurred_at: typeof g?.createdAt === 'string' ? g.createdAt as string : undefined });
    }
  }
  // job tracker notes
  for (const j of args.jobs ?? []) {
    const text = [j?.role, j?.company, j?.notes, j?.outcome].filter(v => typeof v === 'string').join('. ');
    if (text.trim()) {
      out.push({ source_type: 'job_note', source_id: String(j?._id ?? j?.id ?? ''), text,
                 occurred_at: typeof j?.createdAt === 'string' ? j.createdAt as string : undefined });
    }
  }
  // transcripts + simulations
  for (const t of args.transcripts ?? []) {
    if (t?.text?.trim()) out.push({ source_type: 'interview_transcript', source_id: t.id ?? '', text: t.text, occurred_at: t.occurred_at });
  }
  for (const s of args.simulations ?? []) {
    if (s?.text?.trim()) out.push({ source_type: 'simulation', source_id: s.id ?? '', text: s.text, occurred_at: s.occurred_at });
  }
  return out;
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
