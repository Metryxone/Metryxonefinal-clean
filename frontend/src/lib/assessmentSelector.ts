/**
 * Profile-aware Competency Assessment selector.
 *
 * Picks ~20 questions from the adaptive bank (ADAPTIVE_QUESTION_BANK_V2),
 * ranked by affinity to the candidate's role / industry / stage / function,
 * balanced across the 7 competency domains, and shaped into the legacy AQ
 * contract so the existing AssessmentTab render + scoring code keeps working
 * unchanged.
 *
 * Why: the AssessmentTab previously rendered the same 20 hardcoded questions
 * from `ASSESSMENT_QUESTIONS` regardless of who the candidate was. The adaptive
 * runtime existed but only as a side-panel preview, never driving the actual
 * question flow. This selector closes that gap with a single pure function.
 *
 * Fallback chain:
 *   1. Adaptive bank, affinity-ranked, balanced across domains   (preferred)
 *   2. Adaptive bank, affinity-ranked, ignoring domain balance   (fill)
 *   3. Static catalog ASSESSMENT_QUESTIONS                       (last resort)
 */
import {
  ADAPTIVE_QUESTION_BANK_V2,
  type AdaptiveQuestion,
  type PickContext,
} from '@/data/catalogs/assessment-question-bank-v2';
import {
  ASSESSMENT_QUESTIONS,
  type AQ,
} from '@/data/catalogs/assessment-questions';

/** Bank prefix → static-catalog domain code prefix used by scoring. */
const DOMAIN_PREFIX_MAP: Record<string, string> = {
  COG: 'COG',
  COM: 'COM',
  LEA: 'LEA',
  EXE: 'EXE',
  ADP: 'ADA', // Adaptive bank uses ADP; static catalog uses ADA
  TEC: 'TEC',
  EIQ: 'EMO', // Adaptive bank uses EIQ; static catalog uses EMO
};

/** Domain prefix → human-readable label (matches DOMAIN_COLORS keys). */
const DOMAIN_LABEL_MAP: Record<string, string> = {
  COG: 'Cognitive & Analytical',
  COM: 'Communication',
  LEA: 'Leadership & Initiative',
  EXE: 'Execution & Delivery',
  ADP: 'Adaptability & Growth',
  TEC: 'Technical & Domain',
  EIQ: 'Emotional & Social Intelligence',
};

/** Map AdaptiveQuestion.question_type → legacy AQ.type.
 *  `behavioral` + `communication` items in the bank carry real best-option
 *  multiple-choice options (4 distinct response patterns scored 100/60/20/20),
 *  so they belong in the SJT bucket — NOT the Likert ladder, which would
 *  throw their authored options away. */
function mapQuestionType(t: AdaptiveQuestion['question_type']): AQ['type'] {
  if (t === 'mcq') return 'mcq';
  if (
    t === 'sjt' || t === 'scenario' || t === 'case' || t === 'simulation' ||
    t === 'behavioral' || t === 'communication'
  ) return 'sjt';
  return 'likert';
}

/** Affinity score (mirrors the bank's internal scoring; kept local to avoid coupling). */
function affinityScore(q: AdaptiveQuestion, ctx: PickContext | undefined): number {
  if (!ctx) return 0;
  const haystack = `${ctx.role || ''} ${ctx.industry || ''} ${ctx.stage || ''} ${ctx.department || ''} ${ctx.subDepartment || ''}`.toLowerCase();
  const matchAny = (tags?: string[]) => !!tags && tags.length > 0 && tags.some((t) => haystack.includes(t));
  const hasAny = (tags?: string[]) => !!tags && tags.length > 0;
  let s = 0;
  if (matchAny(q.role_tags)) s += 1.5;
  if (matchAny(q.industry_tags)) s += 1.0;
  if (matchAny(q.stage_tags)) s += 0.7;
  if (matchAny(q.function_tags)) s += 0.5;
  // Mismatch penalty: a question with role/function tags that DO NOT match the
  // user is a worse fit than a fully-untagged "generalist" item. Without this,
  // ties at score=0 are resolved by input order — and the bank lists
  // product/strategy-tagged items first, so non-product users see those first.
  if (s === 0) {
    if (hasAny(q.role_tags)) s -= 0.4;
    if (hasAny(q.function_tags)) s -= 0.2;
    if (hasAny(q.industry_tags)) s -= 0.2;
  }
  return s;
}

/**
 * Convert AdaptiveQuestion → AQ. Synthesises options with scoring based on
 * `best_option` (best=100, near-best=60, others=20). Likert items get the
 * standard 5-point ladder.
 */
function toAQ(q: AdaptiveQuestion, ordinalWithinDomain: number): AQ {
  const mappedDomainPrefix = DOMAIN_PREFIX_MAP[q.competency_code] ?? q.competency_code;
  const domainLabel = DOMAIN_LABEL_MAP[q.competency_code] ?? 'Cognitive & Analytical';
  const code = `${mappedDomainPrefix}${String(ordinalWithinDomain).padStart(2, '0')}`;
  const type = mapQuestionType(q.question_type);

  let options: AQ['options'];
  if (type === 'likert' || !q.options || q.options.length === 0) {
    options = [
      { label: 'Strongly Disagree', score: 0 },
      { label: 'Disagree', score: 25 },
      { label: 'Neutral', score: 50 },
      { label: 'Agree', score: 75 },
      { label: 'Strongly Agree', score: 100 },
    ];
  } else {
    const best = q.best_option ?? -1;
    options = q.options.map((label, i) => {
      let score = 20;
      if (i === best) score = 100;
      else if (best >= 0 && Math.abs(i - best) === 1) score = 60;
      return { label, score };
    });
  }

  return {
    id: `ad-${q.id}`,
    code,
    competency: `${domainLabel} · ${q.difficulty}`,
    domain: domainLabel,
    type,
    text: q.prompt,
    options,
  };
}

/**
 * Per-user attempt counter — increments every time a new assessment starts.
 * Stored in localStorage, scoped by userKey so multiple profiles on one
 * browser don't share counters. Best-effort: SSR / disabled-storage falls
 * back to 0.
 */
const ATTEMPT_KEY_PREFIX = 'mx-assessment-attempt:';
const SERVED_KEY_PREFIX = 'mx-assessment-served:';

export function getAssessmentAttempt(userKey: string | undefined): number {
  if (!userKey || typeof window === 'undefined') return 0;
  try {
    const v = window.localStorage.getItem(ATTEMPT_KEY_PREFIX + userKey);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch { return 0; }
}

export function bumpAssessmentAttempt(userKey: string | undefined): number {
  if (!userKey || typeof window === 'undefined') return 0;
  try {
    const next = getAssessmentAttempt(userKey) + 1;
    window.localStorage.setItem(ATTEMPT_KEY_PREFIX + userKey, String(next));
    return next;
  } catch { return 0; }
}

/**
 * Per-user, per-domain set of previously-served question IDs. Lets the
 * selector skip questions the user has already seen on past attempts, so
 * retakes truly surface fresh items (rotation alone isn't enough when a
 * domain pool is small relative to `want`). When a domain is exhausted
 * we silently clear its served set so the cycle restarts.
 */
function readServed(userKey: string): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SERVED_KEY_PREFIX + userKey);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function writeServed(userKey: string, served: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SERVED_KEY_PREFIX + userKey, JSON.stringify(served));
  } catch { /* quota / disabled — silent */ }
}
export function resetServedQuestions(userKey: string | undefined) {
  if (!userKey || typeof window === 'undefined') return;
  try { window.localStorage.removeItem(SERVED_KEY_PREFIX + userKey); } catch {}
}

/**
 * Select N profile-tailored questions for the Competency Assessment.
 * Defaults to 20 total (matches existing UX commitment of "~15 min · 20 questions").
 *
 * `attempt` is the user's 0-indexed retake counter. It rotates the starting
 * offset within each domain's affinity-ranked pool so the 2nd, 3rd, … takes
 * see different questions. Affinity ordering is preserved: high-affinity
 * items stay clustered at the top — the offset just slides the window.
 */
export function selectAssessmentQuestions(
  ctx: PickContext | undefined,
  total = 20,
  attempt = 0,
  userKey?: string,
): AQ[] {
  const baseDomains = Object.keys(DOMAIN_LABEL_MAP); // COG, COM, LEA, EXE, ADP, TEC, EIQ
  // Rotate domain order by attempt so the "short" slot (when total doesn't
  // divide evenly) doesn't always land on the same domain (EIQ was always
  // shortchanged with 2 instead of 3 questions).
  const domShift = baseDomains.length > 0 ? attempt % baseDomains.length : 0;
  const domains = baseDomains.slice(domShift).concat(baseDomains.slice(0, domShift));
  const perDomain = Math.floor(total / domains.length); // 2
  const extra = total - perDomain * domains.length;     // 6

  const usedIds = new Set<string>();
  // Per-domain picks held separately so we can interleave them at the end
  // (user shouldn't see 3 COG questions back-to-back at the start).
  const byDom: Record<string, AQ[]> = {};

  // Per-user served-ID memory: skip questions the user has already seen on
  // prior attempts. If a domain's pool is fully consumed, clear that domain's
  // record so the cycle restarts (rather than blocking selection).
  const served: Record<string, string[]> = userKey ? readServed(userKey) : {};
  const newlyServed: Record<string, string[]> = {};

  domains.forEach((dom, idx) => {
    const want = perDomain + (idx < extra ? 1 : 0);
    const pool = ADAPTIVE_QUESTION_BANK_V2.filter((q) => q.competency_code === dom);
    if (pool.length === 0) return;

    let servedForDom = new Set(served[dom] ?? []);
    // If served has consumed (or nearly consumed) the pool, reset so we don't
    // starve the picker.
    if (pool.length - servedForDom.size < want) {
      servedForDom = new Set();
      served[dom] = [];
    }

    const scored = pool
      .map((q) => ({ q, score: affinityScore(q, ctx) }))
      .sort((a, b) => b.score - a.score);

    // Two-pass: prefer items NOT in servedForDom, fall back to served ones.
    const fresh = scored.filter((s) => !servedForDom.has(s.q.id));
    const stale = scored.filter((s) => servedForDom.has(s.q.id));

    // Tier-preserving rotation: bucket fresh items by affinity score, then
    // rotate WITHIN each tier by attempt. This way high-affinity items
    // always come first across attempts — only tie-breaks rotate. (The old
    // code rotated the whole fresh list and could push a high-affinity
    // item behind low-affinity ones just because it was served earlier.)
    const tiers = new Map<number, typeof fresh>();
    for (const s of fresh) {
      const k = Math.round(s.score * 100) / 100;
      if (!tiers.has(k)) tiers.set(k, []);
      tiers.get(k)!.push(s);
    }
    const rotatedFresh: typeof fresh = [];
    const tierKeys = Array.from(tiers.keys()).sort((a, b) => b - a);
    for (const k of tierKeys) {
      const tier = tiers.get(k)!;
      if (tier.length <= 1) { rotatedFresh.push(...tier); continue; }
      const off = (attempt * Math.max(want, 1)) % tier.length;
      rotatedFresh.push(...tier.slice(off), ...tier.slice(0, off));
    }
    const ordered = rotatedFresh.concat(stale);

    let ordinal = 1;
    const takenThisDomain: string[] = [];
    const domPicks: AQ[] = [];
    for (const s of ordered) {
      if (usedIds.has(s.q.id)) continue;
      const out = toAQ(s.q, ordinal++);
      domPicks.push(out);
      usedIds.add(s.q.id);
      takenThisDomain.push(s.q.id);
      if (ordinal - 1 >= want) break;
    }
    byDom[dom] = domPicks;
    if (takenThisDomain.length) newlyServed[dom] = takenThisDomain;
  });

  // Interleave domains round-robin so the first 7 questions span all 7
  // competencies (rather than 3 COG · 3 COM · ...). Improves perceived
  // breadth + reduces "first question feels off-topic" complaints.
  const picked: AQ[] = [];
  const maxLen = Math.max(0, ...domains.map((d) => byDom[d]?.length ?? 0));
  for (let i = 0; i < maxLen && picked.length < total; i += 1) {
    for (const d of domains) {
      const arr = byDom[d];
      if (arr && arr[i] && picked.length < total) picked.push(arr[i]);
    }
  }

  // Fill from any remaining bank items (affinity-ranked, ignoring domain balance)
  if (picked.length < total) {
    const remaining = ADAPTIVE_QUESTION_BANK_V2
      .filter((q) => !usedIds.has(q.id))
      .map((q) => ({ q, score: affinityScore(q, ctx) }))
      .sort((a, b) => b.score - a.score);
    for (const r of remaining) {
      if (picked.length >= total) break;
      const out = toAQ(r.q, 99); // ordinal placeholder for overflow
      picked.push(out);
      usedIds.add(r.q.id);
    }
  }

  // Last-resort fallback: static catalog (shouldn't trigger unless bank is empty)
  if (picked.length < total) {
    for (const q of ASSESSMENT_QUESTIONS) {
      if (picked.length >= total) break;
      picked.push(q);
    }
  }

  // Persist the freshly-served IDs into the user's served map so the next
  // attempt deprioritises them.
  if (userKey && Object.keys(newlyServed).length) {
    const merged: Record<string, string[]> = { ...served };
    for (const [dom, ids] of Object.entries(newlyServed)) {
      const existing = new Set(merged[dom] ?? []);
      ids.forEach((id) => existing.add(id));
      merged[dom] = Array.from(existing);
    }
    writeServed(userKey, merged);
  }

  return picked.slice(0, total);
}

/**
 * Compute per-domain scores from a selected question list + the user's answers.
 * `answers[qId]` is now the **option index** the user clicked (not the score),
 * so two options sharing a score (common in SJT — non-best options all = 20)
 * no longer get highlighted together in the UI. Score is looked up from the
 * selected question's options array at compute time.
 */
/**
 * API-backed selector. Calls the server-side curated pool (only `status='approved'`
 * templates) and falls back to the local static bank on any error so the UI
 * never gets stuck. Mirrors the same affinity/rotation contract as the local
 * selector — server respects the same `attempt`/`servedIds` semantics.
 */
export async function selectAssessmentQuestionsFromAPI(
  ctx: PickContext | undefined,
  total = 20,
  attempt = 0,
  userKey?: string,
): Promise<AQ[]> {
  try {
    const served = userKey ? readServed(userKey) : {};
    const servedFlat = Object.values(served).flat().join(',');
    const qs = new URLSearchParams();
    qs.set('total', String(total));
    qs.set('attempt', String(attempt));
    if (ctx?.role) qs.set('role', ctx.role);
    if (ctx?.industry) qs.set('industry', ctx.industry);
    if (ctx?.stage) qs.set('stage', ctx.stage);
    if (ctx?.department) qs.set('department', ctx.department);
    if (ctx?.subDepartment) qs.set('sub_department', ctx.subDepartment);
    if (servedFlat) qs.set('served_ids', servedFlat);

    const r = await fetch(`/api/competency/questions/select?${qs.toString()}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`select ${r.status}`);
    const j = await r.json();
    if (!j?.ok || !Array.isArray(j.questions) || j.questions.length === 0) {
      throw new Error('empty payload');
    }
    const picked: AQ[] = j.questions;

    // Persist newly-served IDs into per-user memory. Server attaches `_domain`
    // (raw bank code: COG/COM/LEA/EXE/ADP/TEC/EIQ) and `_origin_id` (matches
    // local pool ids — same key the local selector uses), so the memory map
    // stays consistent across API and fallback paths.
    if (userKey) {
      const newlyServed: Record<string, string[]> = {};
      for (const q of picked as any[]) {
        const dom = (q._domain || '').toUpperCase();
        const id = q._origin_id || (q.id || '').replace(/^ad-/, '');
        if (!dom || !id) continue;
        (newlyServed[dom] ||= []).push(id);
      }
      const merged: Record<string, string[]> = { ...served };
      for (const [dom, ids] of Object.entries(newlyServed)) {
        const existing = new Set(merged[dom] ?? []);
        ids.forEach((id) => existing.add(id));
        merged[dom] = Array.from(existing);
      }
      writeServed(userKey, merged);
    }
    return picked.slice(0, total);
  } catch {
    // Fall back to the local static bank — selector keeps working even when
    // the API is offline / the curated pool is empty in dev.
    return selectAssessmentQuestions(ctx, total, attempt, userKey);
  }
}

export function computeScoresFromSelected(
  selected: AQ[],
  answers: Record<string, number>,
): { competencyCode: string; rawScore: number; confidence: number }[] {
  const byCode: Record<string, number[]> = {};
  for (const q of selected) {
    const idx = answers[q.id];
    if (idx === undefined) continue;
    const opt = q.options[idx];
    if (!opt) continue;
    if (!byCode[q.code]) byCode[q.code] = [];
    byCode[q.code].push(opt.score);
  }
  return Object.entries(byCode).map(([code, scores]) => ({
    competencyCode: code,
    rawScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    confidence: Math.min(1, scores.length / 2),
  }));
}
