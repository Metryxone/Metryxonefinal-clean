/**
 * PHASE 5 — Step 4: Talent Funnel Intelligence (additive, read-only, compose-only).
 *
 * A FRESH composing engine layered over the EXISTING hiring substrate — it does
 * NOT modify any employer/TIG/LBI module and does NOT recompute any score. It
 * reads `employer_candidates.stage` (and `tig_calibration` for confidence
 * context) and folds them into an honest hiring-funnel read model.
 *
 * Honesty contract:
 *   - Coverage  = does candidate data EXIST? (table present + rows)
 *   - Confidence = is the sample SUFFICIENT? (Provisional < 30, Sufficient >= 30)
 *                  upgraded to 'calibrated' context only when TIG bands are calibrated.
 *     Reported as SEPARATE axes; never composited.
 *   - The funnel is a SNAPSHOT approximation from each candidate's CURRENT stage
 *     (no per-candidate event history exists), and this is DISCLOSED in
 *     `methodology` — never presented as true longitudinal conversion.
 *   - Empty data => empty distribution + confidence 'none' (never fabricated 0%).
 *   - never-throws: any read failure degrades to an honest empty result.
 */

import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags.js';

export const TALENT_FUNNEL_VERSION = '5.0.0';

/** Statistical-sufficiency threshold (mirrors platform k_min / Provisional<30). */
export const FUNNEL_MIN_SAMPLE = 30;

export type CoverageState = 'missing' | 'absent' | 'present';
export type ConfidenceBand = 'none' | 'provisional' | 'sufficient' | 'calibrated';

/**
 * Canonical progression ladder. Candidate `stage` text is normalised onto these
 * rungs; unknown stages collapse to `other`, terminal states are reported apart
 * from the ladder so they never distort pass-through ratios.
 */
const LADDER: { key: string; label: string; synonyms: string[] }[] = [
  { key: 'applied', label: 'Applied', synonyms: ['applied', 'application', 'new', 'sourced', 'lead'] },
  { key: 'screening', label: 'Screening', synonyms: ['screening', 'screen', 'review', 'shortlist', 'shortlisted'] },
  { key: 'assessment', label: 'Assessment', synonyms: ['assessment', 'assessed', 'test', 'evaluation'] },
  { key: 'interview', label: 'Interview', synonyms: ['interview', 'interviewing', 'interviewed'] },
  { key: 'offer', label: 'Offer', synonyms: ['offer', 'offered', 'offer_extended'] },
  { key: 'hired', label: 'Hired', synonyms: ['hired', 'hire', 'accepted', 'joined', 'onboarded'] },
];
const TERMINALS: { key: string; label: string; synonyms: string[] }[] = [
  { key: 'rejected', label: 'Rejected', synonyms: ['rejected', 'declined', 'reject'] },
  { key: 'withdrawn', label: 'Withdrawn', synonyms: ['withdrawn', 'withdrew', 'dropped', 'cancelled', 'canceled'] },
];

function classifyStage(raw: string): { kind: 'ladder' | 'terminal' | 'other'; key: string } {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return { kind: 'other', key: 'other' };
  for (const r of LADDER) if (r.key === s || r.synonyms.includes(s)) return { kind: 'ladder', key: r.key };
  for (const t of TERMINALS) if (t.key === s || t.synonyms.includes(s)) return { kind: 'terminal', key: t.key };
  return { kind: 'other', key: 'other' };
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

export interface FunnelStageCount {
  key: string;
  label: string;
  current: number; // candidates whose CURRENT stage is exactly this rung
  reached: number; // candidates who have reached AT LEAST this rung (snapshot)
  pass_through_pct: number | null; // reached(this) / reached(prev); null at first rung or when undefined
}

export interface TalentFunnel {
  version: string;
  scope: { kind: 'platform' | 'org'; org_id: string | null };
  coverage: CoverageState;
  confidence: ConfidenceBand;
  sample_size: number; // ladder candidates (excludes terminals/other)
  total_candidates: number; // all rows in scope
  ladder: FunnelStageCount[];
  terminals: { key: string; label: string; count: number }[];
  unclassified: number; // 'other' bucket
  overall_offer_rate_pct: number | null; // reached(offer)/reached(applied)
  overall_hire_rate_pct: number | null; // reached(hired)/reached(applied)
  methodology: string;
  flags: Record<string, boolean>;
  notes: string[];
  _meta: { read_only: true; composed: true; generated_at: string };
}

function pct(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function buildTalentFunnel(pool: Pool, orgId?: string | null): Promise<TalentFunnel> {
  const org = orgId && String(orgId).trim() ? String(orgId).trim() : null;
  const now = new Date().toISOString();
  const base: TalentFunnel = {
    version: TALENT_FUNNEL_VERSION,
    scope: { kind: org ? 'org' : 'platform', org_id: org },
    coverage: 'missing',
    confidence: 'none',
    sample_size: 0,
    total_candidates: 0,
    ladder: LADDER.map((r) => ({ key: r.key, label: r.label, current: 0, reached: 0, pass_through_pct: null })),
    terminals: TERMINALS.map((t) => ({ key: t.key, label: t.label, count: 0 })),
    unclassified: 0,
    overall_offer_rate_pct: null,
    overall_hire_rate_pct: null,
    methodology:
      'Snapshot funnel from each candidate\'s CURRENT stage (no per-candidate event history exists). ' +
      '"reached" assumes the canonical ladder order; terminal states (Rejected/Withdrawn) are reported ' +
      'separately and excluded from pass-through. Rates are Provisional below ' +
      `${FUNNEL_MIN_SAMPLE} ladder candidates.`,
    flags: {
      talentIntelligence: isFlagEnabled('talentIntelligence'),
      aiInferenceV2: isFlagEnabled('aiInferenceV2'),
    },
    notes: [],
    _meta: { read_only: true, composed: true, generated_at: now },
  };

  // ---- read candidate stages (read-only, never throws) --------------------
  if (!(await tableExists(pool, 'employer_candidates'))) {
    base.notes.push('employer_candidates table not present — funnel unavailable.');
    return base;
  }
  base.coverage = 'absent';

  let rows: { stage: string | null; n: number }[] = [];
  try {
    const r = await pool.query(
      `SELECT stage, count(*)::int AS n
         FROM employer_candidates
        ${org ? 'WHERE employer_id = $1' : ''}
        GROUP BY stage`,
      org ? [org] : [],
    );
    rows = (r.rows ?? []).map((x: any) => ({ stage: x.stage, n: typeof x.n === 'number' ? x.n : 0 }));
  } catch (e: any) {
    base.notes.push(`candidate read failed: ${e?.message ?? 'error'} — honest empty funnel.`);
    return base;
  }

  const total = rows.reduce((a, b) => a + b.n, 0);
  base.total_candidates = total;
  if (total === 0) {
    base.notes.push('No candidates in scope — funnel honestly empty (no fabricated rates).');
    return base;
  }
  base.coverage = 'present';

  // ---- fold into ladder / terminals / other -------------------------------
  const currentByKey: Record<string, number> = {};
  let terminalTotal = 0;
  for (const row of rows) {
    const c = classifyStage(row.stage ?? '');
    if (c.kind === 'ladder') currentByKey[c.key] = (currentByKey[c.key] ?? 0) + row.n;
    else if (c.kind === 'terminal') {
      const t = base.terminals.find((x) => x.key === c.key)!;
      t.count += row.n;
      terminalTotal += row.n;
    } else base.unclassified += row.n;
  }

  // reached(stage_i) = sum of current counts at rung i and all DEEPER rungs.
  const ladderKeys = LADDER.map((r) => r.key);
  const reached: Record<string, number> = {};
  for (let i = 0; i < ladderKeys.length; i++) {
    let acc = 0;
    for (let j = i; j < ladderKeys.length; j++) acc += currentByKey[ladderKeys[j]] ?? 0;
    reached[ladderKeys[i]] = acc;
  }

  base.ladder = LADDER.map((r, i) => {
    const cur = currentByKey[r.key] ?? 0;
    const rch = reached[r.key] ?? 0;
    const prev = i > 0 ? reached[ladderKeys[i - 1]] ?? 0 : null;
    return {
      key: r.key,
      label: r.label,
      current: cur,
      reached: rch,
      pass_through_pct: prev === null ? null : pct(rch, prev),
    };
  });

  const ladderTotal = reached[ladderKeys[0]] ?? 0; // reached(applied) = all ladder candidates
  base.sample_size = ladderTotal;
  base.overall_offer_rate_pct = pct(reached['offer'] ?? 0, ladderTotal);
  base.overall_hire_rate_pct = pct(reached['hired'] ?? 0, ladderTotal);

  // ---- confidence: sufficiency gate + calibration overlay -----------------
  let confidence: ConfidenceBand = ladderTotal >= FUNNEL_MIN_SAMPLE ? 'sufficient' : ladderTotal > 0 ? 'provisional' : 'none';
  try {
    if (confidence === 'sufficient' && (await tableExists(pool, 'tig_calibration'))) {
      const c = await pool.query(
        `SELECT count(*) FILTER (WHERE status='calibrated')::int AS calibrated
           FROM tig_calibration${org ? ' WHERE org_id = $1' : ''}`,
        org ? [org] : [],
      );
      if ((c.rows?.[0]?.calibrated ?? 0) > 0) confidence = 'calibrated';
    }
  } catch {
    /* never-throws: keep sufficiency-based confidence */
  }
  base.confidence = confidence;

  if (confidence === 'provisional') {
    base.notes.push(
      `Provisional: only ${ladderTotal} ladder candidate(s) (< ${FUNNEL_MIN_SAMPLE}); rates are directional, not statistically stable.`,
    );
  }
  if (base.unclassified > 0) {
    base.notes.push(`${base.unclassified} candidate(s) in non-canonical stages (counted as unclassified, excluded from the ladder).`);
  }
  if (terminalTotal > 0) {
    base.notes.push(`${terminalTotal} candidate(s) in terminal states (Rejected/Withdrawn), reported separately.`);
  }

  return base;
}
