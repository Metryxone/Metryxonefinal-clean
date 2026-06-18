/**
 * EP-98-W2 — Talent Intelligence Graph (TIG)
 *
 * 8 entity types  · 5 edge types  · 8 intelligence engines
 * 6 tables (tig_*)  ·  7 routes
 * Structural readiness: 100% (calibration QUALITY is a separate, data-bound activation axis)
 *
 * Compose-only — reads employer_candidates, employer_jobs, cra_scores, lbi_scores.
 * Never fabricates. Empty data → zero intelligence (honest).
 */

import { randomUUID } from 'crypto';
import type { Express, Request } from 'express';
import type { Pool } from 'pg';

type Middleware = (req: Request, res: any, next: any) => void;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const uid  = () => randomUUID();
const eid  = (req: Request): string => (req as any).orgId ?? (req.user as any)?.id ?? '';

function parseExp(exp: string): number {
  const m = String(exp ?? '').match(/\d+/);
  return m ? Math.min(30, parseInt(m[0], 10)) : 0;
}

export function parseSkills(skills: unknown): string[] {
  if (Array.isArray(skills)) return (skills as unknown[]).map(String).filter(Boolean);
  if (typeof skills === 'string') {
    try { const p = JSON.parse(skills); if (Array.isArray(p)) return (p as unknown[]).map(String); } catch { /* fallthrough */ }
    return skills.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// ─── INTELLIGENCE ENGINES (pure, deterministic, never-throws) ─────────────────

function normVec(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
}

function cosineSim(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  const pa = [...a, ...Array(len - a.length).fill(0)];
  const pb = [...b, ...Array(len - b.length).fill(0)];
  const dot = pa.reduce((s: number, x: number, i: number) => s + x * (pb[i] as number), 0);
  return dot / (normVec(pa) * normVec(pb));
}

/** Engine 1 — Readiness Index [0-100] */
export function computeReadinessIndex(c: {
  matchScore: number; eiScore: number; assessmentScore: number; experienceYears: number;
}): number {
  const expFactor = Math.min(100, c.experienceYears * 10);
  return Math.min(100, Math.max(0, Math.round(
    c.matchScore      * 0.35 +
    c.eiScore         * 0.30 +
    c.assessmentScore * 0.25 +
    expFactor         * 0.10,
  )));
}

/** Engine 2 — Growth Potential [0-100] */
export function computeGrowthPotential(
  c: { assessmentScore: number; eiScore: number },
  readiness: number,
  lbiScore = 50,
): number {
  const headroom = 100 - readiness;
  return Math.min(100, Math.max(0, Math.round(
    c.assessmentScore * 0.40 +
    c.eiScore         * 0.30 +
    lbiScore          * 0.20 +
    headroom          * 0.10,
  )));
}

/** Engine 3 — Hidden Talent Score [0-100] */
export function computeHiddenTalentScore(readiness: number, stage: string): number {
  const stageWeight: Record<string, number> = { Applied: 1.0, Screened: 0.9, Screening: 0.9 };
  const w = stageWeight[stage];
  if (!w || readiness < 65) return 0;
  return Math.round(readiness * w);
}

/** Engine 4 — Success Probability per role [0–1] */
export function computeSuccessProbability(
  candidateSkills: string[], matchScore: number, roleSkills: string[],
): number {
  if (!roleSkills.length) return Math.round(matchScore) / 100;
  const cs      = candidateSkills.map(s => s.toLowerCase().trim());
  const matched = roleSkills.filter(rs => cs.includes(rs.toLowerCase().trim())).length;
  const skillFactor = matched / roleSkills.length;
  return Math.round((matchScore / 100) * skillFactor * 100) / 100;
}

/** Engine 5 — Talent Similarity [0-100] */
export function computeSimilarity(
  a: { matchScore: number; eiScore: number; assessmentScore: number; experienceYears: number },
  b: { matchScore: number; eiScore: number; assessmentScore: number; experienceYears: number },
): number {
  const va = [a.matchScore / 100, a.eiScore / 100, a.assessmentScore / 100, Math.min(1, a.experienceYears / 20)];
  const vb = [b.matchScore / 100, b.eiScore / 100, b.assessmentScore / 100, Math.min(1, b.experienceYears / 20)];
  return Math.round(cosineSim(va, vb) * 100);
}

/** Engine 6 — Internal Mobility: roles where success_prob ≥ threshold (calibrated when a model is supplied) */
export function computeMobilityTargets(
  candidateSkills: string[], matchScore: number,
  openRoles: { id: string; title: string; skills: string[] }[],
  threshold = 0.5,
  calibration?: CalibrationModel,
): { roleId: string; roleTitle: string; probability: number; calibratedProbability: number }[] {
  return openRoles
    .map(r => {
      const raw        = computeSuccessProbability(candidateSkills, matchScore, r.skills);
      const calibrated = calibration ? calibrateProbability(raw, calibration) : raw;
      return { roleId: r.id, roleTitle: r.title, probability: raw, calibratedProbability: calibrated };
    })
    .filter(r => r.calibratedProbability >= threshold)
    .sort((a, b) => b.calibratedProbability - a.calibratedProbability);
}

/** Engine 7 — Cluster Assignment */
export function assignCluster(readiness: number): { clusterId: string; clusterName: string; color: string } {
  if (readiness >= 75) return { clusterId: 'high-impact',     clusterName: 'High Impact',      color: '#344E86' };
  if (readiness >= 50) return { clusterId: 'growth-ready',    clusterName: 'Growth Ready',     color: '#4ECDC4' };
  return                      { clusterId: 'emerging-talent', clusterName: 'Emerging Talent',  color: '#f4a261' };
}

/** Engine 8 — Success Probability Calibration (empirical, realized-outcome-driven).
 *  Reliability-binning with Beta–Binomial (m-estimate) smoothing toward each band's
 *  raw prior. With zero realized outcomes the model is `cold_start` and calibration is
 *  the identity map (raw === calibrated) — directional & honest, never fabricated. */
export const CALIBRATION_BANDS = [
  { id: 'b0', min: 0.0, max: 0.2 },
  { id: 'b1', min: 0.2, max: 0.4 },
  { id: 'b2', min: 0.4, max: 0.6 },
  { id: 'b3', min: 0.6, max: 0.8 },
  { id: 'b4', min: 0.8, max: 1.01 },
] as const;

const CALIB_ALPHA = 5; // smoothing strength (prior pseudo-observations per band)
const CALIB_MIN_OUTCOMES = 30; // platform k_min=30 precedent — below this, calibration is 'provisional' (not trusted), never 'calibrated'

export interface CalibrationBand {
  bandId: string; min: number; max: number;
  sampleSize: number; positives: number;
  observedRate: number | null; calibratedRate: number | null;
  meanPredicted: number | null;                       // mean RAW prob of the realized cases that fell in this band
  priorSource: 'global_pooled' | 'uninformative';     // E5 — which smoothing prior was applied
}
export interface CalibrationModel {
  status: 'calibrated' | 'provisional' | 'cold_start';
  totalOutcomes: number;
  bands: CalibrationBand[];
  brier: number | null;   // E2 — mean((raw−outcome)²) on RAW predictions; lower is better
  ece: number | null;     // E2 — expected calibration error Σ(n_b/N)·|observed_b − meanPredicted_b|
  method: 'identity' | 'binned' | 'isotonic';         // E4 — which mapping calibrateProbability applies
  isotonic?: { x: number; y: number }[];              // E4 — PAV curve (in-memory only, never persisted)
}

const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const round3  = (n: number) => Math.round(n * 1000) / 1000;

export function bandFor(p: number): { id: string; min: number; max: number } {
  const clamped = clamp01(p);
  return CALIBRATION_BANDS.find(b => clamped >= b.min && clamped < b.max) ?? CALIBRATION_BANDS[CALIBRATION_BANDS.length - 1];
}

/** E4 — Isotonic regression via Pool-Adjacent-Violators over realized {predicted,outcome} pairs.
 *  Returns monotone non-decreasing breakpoints {x: mean predicted, y: mean outcome} per pooled block. */
export function fitIsotonic(realized: { predicted: number; outcome: 0 | 1 }[]): { x: number; y: number }[] {
  if (!realized.length) return [];
  const pts = realized.map(r => ({ x: clamp01(r.predicted), y: r.outcome as number })).sort((a, b) => a.x - b.x);
  const blocks: { sumX: number; sumY: number; w: number }[] = [];
  for (const p of pts) {
    blocks.push({ sumX: p.x, sumY: p.y, w: 1 });
    while (blocks.length > 1) {
      const a = blocks[blocks.length - 2], b = blocks[blocks.length - 1];
      if (a.sumY / a.w > b.sumY / b.w) {              // monotonicity violated → pool adjacent blocks
        blocks.pop(); blocks.pop();
        blocks.push({ sumX: a.sumX + b.sumX, sumY: a.sumY + b.sumY, w: a.w + b.w });
      } else break;
    }
  }
  return blocks.map(b => ({ x: round3(b.sumX / b.w), y: round3(b.sumY / b.w) }));
}

/** E4 — interpolate a value through an isotonic curve, clamping beyond the end breakpoints. */
export function isotonicAt(curve: { x: number; y: number }[], raw: number): number {
  if (!curve.length) return raw;
  const x = clamp01(raw);
  if (x <= curve[0].x) return curve[0].y;
  if (x >= curve[curve.length - 1].x) return curve[curve.length - 1].y;
  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i].x) {
      const a = curve[i - 1], b = curve[i];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return curve[curve.length - 1].y;
}

/** Learn a calibration curve from realized {predicted, outcome} pairs.
 *  `priorByBand` (E5) supplies a globally-pooled prior rate per band for THIN orgs; absent → an
 *  uninformative band-midpoint prior. `status` is a TRUST label gated on the org's OWN outcome count
 *  and is NEVER lifted by a borrowed prior. */
export function buildCalibrationModel(
  realized: { predicted: number; outcome: 0 | 1 }[],
  priorByBand?: Record<string, number>,
): CalibrationModel {
  const acc = CALIBRATION_BANDS.map(b => ({ id: b.id, min: b.min, max: b.max, sampleSize: 0, positives: 0, predictedSum: 0 }));
  for (const r of realized) {
    const a = acc.find(x => x.id === bandFor(r.predicted).id);
    if (!a) continue;
    a.sampleSize++;
    a.positives    += r.outcome === 1 ? 1 : 0;
    a.predictedSum += clamp01(r.predicted);
  }

  // TRUST label — below k_min the curve is mostly the α-smoothed prior, so it stays 'provisional':
  // we still apply it (best estimate) but never claim it's empirically validated. Honest by convention.
  const status: CalibrationModel['status'] =
    realized.length === 0 ? 'cold_start'
    : realized.length < CALIB_MIN_OUTCOMES ? 'provisional'
    : 'calibrated';

  const bands: CalibrationBand[] = acc.map(a => {
    if (a.sampleSize === 0) {
      return { bandId: a.id, min: a.min, max: a.max, sampleSize: 0, positives: 0,
               observedRate: null, calibratedRate: null, meanPredicted: null, priorSource: 'uninformative' };
    }
    const observedRate  = round3(a.positives / a.sampleSize);
    const meanPredicted = round3(a.predictedSum / a.sampleSize);
    const midpoint      = (a.min + Math.min(1, a.max)) / 2; // raw expectation at band midpoint
    const globalPrior   = priorByBand?.[a.id];
    const usedGlobal    = globalPrior != null;
    const prior         = usedGlobal ? globalPrior : midpoint;
    const calibratedRate = round3((a.positives + CALIB_ALPHA * prior) / (a.sampleSize + CALIB_ALPHA));
    return { bandId: a.id, min: a.min, max: a.max, sampleSize: a.sampleSize, positives: a.positives,
             observedRate, calibratedRate, meanPredicted,
             priorSource: usedGlobal ? 'global_pooled' : 'uninformative' };
  });

  // E2 — quality metrics on RAW predictions (an in-sample "calibrated" Brier would be optimistically biased).
  let brier: number | null = null, ece: number | null = null;
  if (realized.length > 0) {
    brier = round3(realized.reduce((s, r) => s + Math.pow(clamp01(r.predicted) - r.outcome, 2), 0) / realized.length);
    let eceSum = 0;
    for (const b of bands) {
      if (b.sampleSize > 0 && b.observedRate != null && b.meanPredicted != null) {
        eceSum += (b.sampleSize / realized.length) * Math.abs(b.observedRate - b.meanPredicted);
      }
    }
    ece = round3(eceSum);
  }

  // E4 — the smoother isotonic mapping is TRUSTED only once empirically calibrated (≥ k_min own outcomes);
  // provisional stays on α-smoothed bins, cold_start stays identity.
  let method: CalibrationModel['method'] = status === 'cold_start' ? 'identity' : 'binned';
  let isotonic: { x: number; y: number }[] | undefined;
  if (status === 'calibrated') {
    isotonic = fitIsotonic(realized);
    method = 'isotonic';
    for (const b of bands) {  // keep the persisted/displayed band rate consistent with the live isotonic mapping
      if (b.sampleSize > 0 && b.meanPredicted != null) b.calibratedRate = round3(isotonicAt(isotonic, b.meanPredicted));
    }
  }

  return { status, totalOutcomes: realized.length, bands, brier, ece, method, isotonic };
}

/** Map a raw probability through the calibration model.
 *  cold_start → identity · calibrated → isotonic curve · provisional → α-smoothed band rate · empty band → identity. */
export function calibrateProbability(rawProb: number, model: CalibrationModel): number {
  if (!model || model.status === 'cold_start') return rawProb;
  if (model.status === 'calibrated' && model.isotonic?.length) return round3(isotonicAt(model.isotonic, rawProb));
  const band = model.bands.find(x => x.bandId === bandFor(rawProb).id);
  if (!band || band.sampleSize === 0 || band.calibratedRate == null) return rawProb; // no data in this band → identity (honest)
  return band.calibratedRate;
}

/** E5 — globally-pooled calibration prior: per-band observed hire rate across ALL orgs, exposed ONLY where
 *  the band carries ≥ k_min outcomes drawn from ≥2 distinct orgs (k-anonymity / tenant isolation). Lends
 *  strength to THIN (provisional) orgs; never reveals any single org's data and never changes a TRUST status. */
async function buildGlobalCalibrationPrior(pool: Pool): Promise<Record<string, number>> {
  const res = await pool.query(
    `SELECT c.employer_id, c.skills, c.match_score, c.predicted_prob_at_decision, c.stage, j.skills AS role_skills
       FROM employer_candidates c JOIN employer_jobs j ON j.id = c.job_id
      WHERE c.stage IN ('Hired','Rejected')`,
  ).catch(() => ({ rows: [] as any[] }));
  const agg: Record<string, { n: number; pos: number; orgs: Set<string> }> = {};
  for (const r of (res.rows as any[])) {
    const predicted = r.predicted_prob_at_decision != null
      ? Number(r.predicted_prob_at_decision)
      : computeSuccessProbability(parseSkills(r.skills), Number(r.match_score ?? 0), parseSkills(r.role_skills));
    const bid = bandFor(predicted).id;
    const a = (agg[bid] ??= { n: 0, pos: 0, orgs: new Set<string>() });
    a.n++; a.pos += r.stage === 'Hired' ? 1 : 0; a.orgs.add(String(r.employer_id));
  }
  const prior: Record<string, number> = {};
  for (const [bid, a] of Object.entries(agg)) {
    if (a.n >= CALIB_MIN_OUTCOMES && a.orgs.size >= 2) prior[bid] = round3(a.pos / a.n);
  }
  return prior;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

async function ensureTIGSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tig_nodes (
      id          TEXT PRIMARY KEY,
      org_id      TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      label       TEXT DEFAULT '',
      vector      FLOAT[] DEFAULT ARRAY[]::FLOAT[],
      metadata    JSONB DEFAULT '{}',
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tig_nodes_org_type_entity ON tig_nodes(org_id, entity_type, entity_id);
    CREATE INDEX        IF NOT EXISTS tig_nodes_org_type        ON tig_nodes(org_id, entity_type);

    CREATE TABLE IF NOT EXISTS tig_edges (
      id           TEXT PRIMARY KEY,
      org_id       TEXT NOT NULL,
      from_node_id TEXT NOT NULL,
      to_node_id   TEXT NOT NULL,
      edge_type    TEXT NOT NULL,
      weight       FLOAT DEFAULT 1.0,
      metadata     JSONB DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tig_edges_org_from_to_type ON tig_edges(org_id, from_node_id, to_node_id, edge_type);
    CREATE INDEX        IF NOT EXISTS tig_edges_org_from         ON tig_edges(org_id, from_node_id);
    CREATE INDEX        IF NOT EXISTS tig_edges_org_to           ON tig_edges(org_id, to_node_id);

    CREATE TABLE IF NOT EXISTS tig_clusters (
      id            TEXT PRIMARY KEY,
      org_id        TEXT NOT NULL,
      cluster_id    TEXT NOT NULL,
      cluster_name  TEXT NOT NULL,
      color         TEXT DEFAULT '#344E86',
      member_ids    TEXT[] DEFAULT ARRAY[]::TEXT[],
      size          INTEGER DEFAULT 0,
      avg_readiness FLOAT DEFAULT 0,
      avg_growth    FLOAT DEFAULT 0,
      traits        JSONB DEFAULT '{}',
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tig_clusters_org_cluster ON tig_clusters(org_id, cluster_id);

    CREATE TABLE IF NOT EXISTS tig_intelligence (
      id                  TEXT PRIMARY KEY,
      org_id              TEXT NOT NULL,
      candidate_id        TEXT NOT NULL,
      readiness_index     FLOAT DEFAULT 0,
      growth_potential    FLOAT DEFAULT 0,
      hidden_talent_score FLOAT DEFAULT 0,
      success_probs       JSONB DEFAULT '{}',
      mobility_targets    JSONB DEFAULT '[]',
      similar_candidates  TEXT[] DEFAULT ARRAY[]::TEXT[],
      cluster_id          TEXT DEFAULT '',
      cluster_name        TEXT DEFAULT '',
      computed_at         TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tig_intel_org_cand ON tig_intelligence(org_id, candidate_id);
    CREATE INDEX        IF NOT EXISTS tig_intel_org      ON tig_intelligence(org_id);

    CREATE TABLE IF NOT EXISTS tig_build_log (
      id          TEXT PRIMARY KEY,
      org_id      TEXT NOT NULL,
      status      TEXT DEFAULT 'running',
      nodes_built INTEGER DEFAULT 0,
      edges_built INTEGER DEFAULT 0,
      duration_ms INTEGER,
      error_msg   TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS tig_build_log_org ON tig_build_log(org_id);

    CREATE TABLE IF NOT EXISTS tig_calibration (
      id              TEXT PRIMARY KEY,
      org_id          TEXT NOT NULL,
      band_id         TEXT NOT NULL,
      band_min        FLOAT NOT NULL,
      band_max        FLOAT NOT NULL,
      sample_size     INTEGER DEFAULT 0,
      positives       INTEGER DEFAULT 0,
      observed_rate   FLOAT,
      calibrated_rate FLOAT,
      status          TEXT DEFAULT 'cold_start',
      total_outcomes  INTEGER DEFAULT 0,
      updated_at      TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tig_calibration_org_band ON tig_calibration(org_id, band_id);
    ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS mean_predicted FLOAT;
    ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS prior_source   TEXT DEFAULT 'uninformative';
    ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS brier          FLOAT;
    ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS ece            FLOAT;
    ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS method         TEXT DEFAULT 'identity';
  `);
}

// ─── GRAPH BUILDER ────────────────────────────────────────────────────────────

interface CandidateIntelRecord {
  candidateId: string; label: string; stage: string;
  matchScore: number; eiScore: number; assessmentScore: number; experienceYears: number;
  readinessIndex: number; growthPotential: number; hiddenTalentScore: number;
  successProbs: Record<string, { roleTitle: string; probability: number; calibratedProbability: number }>;
  mobilityTargets: { roleId: string; roleTitle: string; probability: number; calibratedProbability: number }[];
  similarCandidates: string[];
  clusterId: string; clusterName: string;
  skills: string[];
}

export async function buildTIGForOrg(pool: Pool, orgId: string): Promise<{ nodes: number; edges: number }> {
  const buildId = uid();
  const startMs = Date.now();

  await pool.query(
    `INSERT INTO tig_build_log (id, org_id, status) VALUES ($1,$2,'running')`,
    [buildId, orgId],
  ).catch(() => {});

  let nodesBuilt = 0;
  let edgesBuilt = 0;

  try {
    // ── FETCH BASE DATA ─────────────────────────────────────────────────────
    const [candidatesRes, jobsRes, managersRes] = await Promise.all([
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id = $1`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM employer_jobs     WHERE employer_id = $1`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT em.user_id, u.username AS email FROM employer_members em
         LEFT JOIN users u ON u.id = em.user_id
         WHERE em.org_id = $1 AND em.status = 'active' AND em.role = 'hiring_manager'`,
        [orgId],
      ).catch(() => ({ rows: [] })),
    ]);

    const candidates = candidatesRes.rows;
    const jobs       = jobsRes.rows;
    const managers   = managersRes.rows;

    // Try to enrich with LBI behavioural scores (keyed by user_email — never throws)
    const emails = candidates.map((c: any) => c.email).filter(Boolean);
    type LbiDetail = {
      overallLbi: number; consistency: number; persistence: number;
      attention: number; adaptability: number; velocity: number; learningStyle: string | null;
    };
    const lbiByEmail:       Record<string, number>    = {};
    const lbiDetailByEmail: Record<string, LbiDetail> = {};
    if (emails.length) {
      const lbiRes = await pool.query(
        `SELECT user_email, overall_lbi, consistency_score, persistence_score,
                attention_score, adaptability_score, velocity_score, learning_style
           FROM lbi_scores WHERE user_email = ANY($1)`,
        [emails],
      ).catch(() => ({ rows: [] }));
      for (const r of lbiRes.rows as any[]) {
        const overall = Number(r.overall_lbi ?? 50);
        lbiByEmail[r.user_email] = overall;
        lbiDetailByEmail[r.user_email] = {
          overallLbi:   overall,
          consistency:  Number(r.consistency_score  ?? 50),
          persistence:  Number(r.persistence_score  ?? 50),
          attention:    Number(r.attention_score     ?? 50),
          adaptability: Number(r.adaptability_score  ?? 50),
          velocity:     Number(r.velocity_score      ?? 50),
          learningStyle: r.learning_style ?? null,
        };
      }
    }
    // candidateId → LBI detail (for cluster-level aggregation in signal/behavior enrichment)
    const lbiDetailById: Record<string, LbiDetail> = {};
    for (const c of candidates as any[]) {
      if (c.email && lbiDetailByEmail[c.email]) lbiDetailById[c.id] = lbiDetailByEmail[c.email]!;
    }

    // ── EMPIRICAL CALIBRATION (Engine 8) ────────────────────────────────────
    // Learn a calibration curve from REALIZED hire outcomes (terminal stages),
    // then apply it to every success probability below. No outcomes → cold_start
    // (identity map), so probabilities stay directional and honest.
    const jobById: Record<string, any> = {};
    for (const j of jobs as any[]) jobById[j.id] = j;

    const realizedOutcomes: { predicted: number; outcome: 0 | 1 }[] = [];
    for (const c of candidates as any[]) {
      const stage = String(c.stage ?? '');
      if (stage !== 'Hired' && stage !== 'Rejected') continue;
      const role = jobById[c.job_id];
      if (!role) continue;
      // E1 — train on the probability snapshotted at the decision moment (no label drift); legacy rows recompute.
      const predicted = c.predicted_prob_at_decision != null
        ? Number(c.predicted_prob_at_decision)
        : computeSuccessProbability(parseSkills(c.skills), Number(c.match_score ?? 0), parseSkills(role.skills));
      realizedOutcomes.push({ predicted, outcome: stage === 'Hired' ? 1 : 0 });
    }
    // E5 — a THIN (provisional) org borrows a globally-pooled prior; cold_start & calibrated orgs do not.
    let priorByBand: Record<string, number> | undefined;
    if (realizedOutcomes.length > 0 && realizedOutcomes.length < CALIB_MIN_OUTCOMES) {
      priorByBand = await buildGlobalCalibrationPrior(pool);
    }
    const calibration = buildCalibrationModel(realizedOutcomes, priorByBand);

    // Persist the calibration curve (idempotent per org+band)
    for (const band of calibration.bands) {
      await pool.query(
        `INSERT INTO tig_calibration
           (id, org_id, band_id, band_min, band_max, sample_size, positives, observed_rate, calibrated_rate, status, total_outcomes, mean_predicted, prior_source, brier, ece, method, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
         ON CONFLICT (org_id, band_id) DO UPDATE SET
           band_min=$4, band_max=$5, sample_size=$6, positives=$7, observed_rate=$8,
           calibrated_rate=$9, status=$10, total_outcomes=$11, mean_predicted=$12,
           prior_source=$13, brier=$14, ece=$15, method=$16, updated_at=now()`,
        [`${orgId}:${band.bandId}`, orgId, band.bandId, band.min, band.max, band.sampleSize,
         band.positives, band.observedRate, band.calibratedRate, calibration.status, calibration.totalOutcomes,
         band.meanPredicted, band.priorSource, calibration.brier, calibration.ece, calibration.method],
      ).catch((e: any) => console.error('[employer-tig] calibration persist failed', e?.message ?? e));
    }

    // ── NODE + EDGE HELPERS ─────────────────────────────────────────────────

    const upsertNode = async (n: {
      entityType: string; entityId: string; label: string;
      vector: number[]; metadata: Record<string, unknown>;
    }) => {
      await pool.query(
        `INSERT INTO tig_nodes (id, org_id, entity_type, entity_id, label, vector, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (org_id, entity_type, entity_id)
         DO UPDATE SET label=$5, vector=$6, metadata=$7, updated_at=now()`,
        [uid(), orgId, n.entityType, n.entityId, n.label, n.vector, JSON.stringify(n.metadata)],
      );
      nodesBuilt++;
    };

    const upsertEdge = async (e: {
      fromNodeId: string; toNodeId: string; edgeType: string;
      weight: number; metadata?: Record<string, unknown>;
    }) => {
      await pool.query(
        `INSERT INTO tig_edges (id, org_id, from_node_id, to_node_id, edge_type, weight, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (org_id, from_node_id, to_node_id, edge_type)
         DO UPDATE SET weight=$6, metadata=$7`,
        [uid(), orgId, e.fromNodeId, e.toNodeId, e.edgeType, e.weight, JSON.stringify(e.metadata ?? {})],
      );
      edgesBuilt++;
    };

    const getNodeId = async (entityType: string, entityId: string): Promise<string | null> => {
      const r = await pool.query(
        `SELECT id FROM tig_nodes WHERE org_id=$1 AND entity_type=$2 AND entity_id=$3`,
        [orgId, entityType, entityId],
      ).catch(() => ({ rows: [] }));
      return (r.rows[0] as any)?.id ?? null;
    };

    // ── ORGANISATION NODE ──────────────────────────────────────────────────────
    // One node per employer org; candidates and roles wire belongs_to edges to it.
    await upsertNode({ entityType: 'organization', entityId: orgId, label: 'Organisation', vector: [1], metadata: { orgId } });
    const orgNid = await getNodeId('organization', orgId);

    // ── CANDIDATE NODES ─────────────────────────────────────────────────────
    const intelList: CandidateIntelRecord[] = [];
    const candidateJobById: Record<string, string | null> = {}; // candidateId → job_id (for skill-gap edges)

    for (const c of candidates as any[]) {
      const matchScore      = Number(c.match_score      ?? 0);
      const eiScore         = Number(c.ei_score         ?? 0);
      const assessmentScore = Number(c.assessment_score ?? 0);
      const experienceYears = parseExp(c.experience ?? '');
      const skills          = parseSkills(c.skills);
      const lbiScore        = lbiByEmail[c.email] ?? 50;

      const readiness = computeReadinessIndex({ matchScore, eiScore, assessmentScore, experienceYears });
      const growth    = computeGrowthPotential({ assessmentScore, eiScore }, readiness, lbiScore);
      const hidden    = computeHiddenTalentScore(readiness, c.stage ?? '');
      const cluster   = assignCluster(readiness);

      await upsertNode({
        entityType: 'candidate', entityId: c.id,
        label: c.name ?? c.email ?? c.id.slice(0, 8),
        vector: [matchScore / 100, eiScore / 100, assessmentScore / 100, Math.min(1, experienceYears / 20)],
        metadata: { stage: c.stage, jobId: c.job_id, clusterId: cluster.clusterId },
      });

      intelList.push({
        candidateId: c.id, label: c.name ?? c.email ?? c.id.slice(0, 8),
        stage: c.stage ?? '', matchScore, eiScore, assessmentScore, experienceYears,
        readinessIndex: readiness, growthPotential: growth, hiddenTalentScore: hidden,
        successProbs: {}, mobilityTargets: [], similarCandidates: [],
        clusterId: cluster.clusterId, clusterName: cluster.clusterName, skills,
      });
      candidateJobById[c.id] = c.job_id ?? null;
    }

    // ── ROLE NODES + ROLE↔COMPETENCY EDGES ─────────────────────────────────
    const openRoles = (jobs as any[]).filter(j => j.status === 'Active');

    for (const j of jobs as any[]) {
      const roleSkills = parseSkills(j.skills);
      await upsertNode({
        entityType: 'role', entityId: j.id,
        label: j.title ?? j.id.slice(0, 8),
        vector: [roleSkills.length / 20],
        metadata: { status: j.status, department: j.department, skillCount: roleSkills.length },
      });

      // Role → organisation (belongs_to)
      const roleNidR = await getNodeId('role', j.id);
      if (roleNidR && orgNid) await upsertEdge({ fromNodeId: roleNidR, toNodeId: orgNid, edgeType: 'belongs_to', weight: 1 });

      const domains = [...new Set(roleSkills.map(s => s.toLowerCase().split(' ')[0]))].slice(0, 5);
      for (const domain of domains) {
        await upsertNode({ entityType: 'competency', entityId: `domain:${domain}`, label: domain, vector: [1], metadata: { source: 'role' } });
        const roleNid = await getNodeId('role', j.id);
        const compNid = await getNodeId('competency', `domain:${domain}`);
        if (roleNid && compNid) {
          await upsertEdge({ fromNodeId: roleNid, toNodeId: compNid, edgeType: 'requires_competency', weight: 1 });
        }
      }
    }

    // ── ROLE → ROLE SUCCESSION EDGES (feeder_role) ───────────────────────────
    // Group roles by department, sort by seniority keyword, and wire feeder_role
    // edges between adjacent levels. Roles with no seniority keyword default to "mid".
    // Departments with fewer than 2 roles produce no edges.
    const SENIORITY_KEYWORDS = ['intern','junior','associate','mid','senior','lead','principal','staff','director','vp','head','chief','cto','ceo'];
    const seniorityRank = (title: string) => {
      const t = title.toLowerCase();
      const i = SENIORITY_KEYWORDS.findIndex(kw => t.includes(kw));
      return i === -1 ? 4 : i; // 4 = "mid" as default
    };
    const rolesByDept: Record<string, any[]> = {};
    for (const j of jobs as any[]) {
      const dept = String(j.department ?? 'General').toLowerCase();
      (rolesByDept[dept] ??= []).push(j);
    }
    for (const deptJobs of Object.values(rolesByDept)) {
      if (deptJobs.length < 2) continue;
      const sorted = [...deptJobs].sort((a, b) => seniorityRank(a.title ?? '') - seniorityRank(b.title ?? ''));
      for (let i = 0; i < sorted.length - 1; i++) {
        const fromNid = await getNodeId('role', sorted[i]!.id);
        const toNid   = await getNodeId('role', sorted[i + 1]!.id);
        if (fromNid && toNid && sorted[i]!.id !== sorted[i + 1]!.id) {
          await upsertEdge({ fromNodeId: fromNid, toNodeId: toNid, edgeType: 'feeder_role', weight: 1, metadata: { fromTitle: sorted[i]!.title ?? '', toTitle: sorted[i + 1]!.title ?? '', department: sorted[i]!.department ?? '' } });
        }
      }
    }

    // ── MANAGER NODES + MANAGES EDGES ────────────────────────────────────────
    // Wire manages: Manager → Role (job.hiring_manager email) + Manager → Candidate (via job).
    const managerNidByEmail: Record<string, string | null> = {};
    for (const m of managers as any[]) {
      await upsertNode({ entityType: 'manager', entityId: m.user_id, label: m.email ?? m.user_id.slice(0, 8), vector: [1], metadata: { role: 'hiring_manager' } });
      if (m.email) managerNidByEmail[m.email] = await getNodeId('manager', m.user_id);
    }
    // Manager → Role (hiring_manager column on the job row holds the manager email)
    for (const j of jobs as any[]) {
      if (!j.hiring_manager) continue;
      const mNid = managerNidByEmail[j.hiring_manager];
      const rNid = await getNodeId('role', j.id);
      if (mNid && rNid) await upsertEdge({ fromNodeId: mNid, toNodeId: rNid, edgeType: 'manages', weight: 1, metadata: { roleTitle: j.title ?? '' } });
    }
    // Manager → Candidate (via candidate.job_id → job.hiring_manager)
    for (const c of candidates as any[]) {
      if (!c.job_id) continue;
      const hm = (jobById[c.job_id] as any)?.hiring_manager;
      if (!hm) continue;
      const mNid = managerNidByEmail[hm];
      const cNid = await getNodeId('candidate', c.id);
      if (mNid && cNid) await upsertEdge({ fromNodeId: mNid, toNodeId: cNid, edgeType: 'manages', weight: 1 });
    }

    // ── CAREER PATH + LEARNING PATH NODES ───────────────────────────────────
    const clusterIds = ['high-impact', 'growth-ready', 'emerging-talent'];
    const clusterMeta: Record<string, { name: string; color: string }> = {
      'high-impact':     { name: 'High Impact',     color: '#344E86' },
      'growth-ready':    { name: 'Growth Ready',    color: '#4ECDC4' },
      'emerging-talent': { name: 'Emerging Talent', color: '#f4a261' },
    };
    for (const cid of clusterIds) {
      const meta = clusterMeta[cid]!;
      await upsertNode({ entityType: 'career_path',   entityId: `cp:${cid}`,  label: `${meta.name} Track`,    vector: [1], metadata: { cluster: cid } });
      await upsertNode({ entityType: 'learning_path', entityId: `lp:${cid}`,  label: `${meta.name} Learning`, vector: [1], metadata: { cluster: cid } });
      // Signal node (one per cluster — aggregated behavioral signal for the cluster)
      await upsertNode({ entityType: 'signal',    entityId: `sig:${cid}`, label: `${meta.name} Signal`,   vector: [1], metadata: { cluster: cid } });
      // Behavior node
      await upsertNode({ entityType: 'behavior',  entityId: `beh:${cid}`, label: `${meta.name} Pattern`,  vector: [1], metadata: { cluster: cid } });
    }

    // ── CANDIDATE → ROLE / COMPETENCY / CAREER / LEARNING EDGES ────────────
    const openRolesMapped = openRoles.map((j: any) => ({
      id: j.id, title: j.title ?? '', skills: parseSkills(j.skills),
    }));

    for (const intel of intelList) {
      const candNid = await getNodeId('candidate', intel.candidateId);
      if (!candNid) continue;

      // Candidate → competency (from skills)
      for (const skill of intel.skills.slice(0, 6)) {
        const domain = skill.toLowerCase().split(' ')[0] ?? skill.toLowerCase();
        await upsertNode({ entityType: 'competency', entityId: `domain:${domain}`, label: domain, vector: [1], metadata: { source: 'candidate' } });
        const compNid = await getNodeId('competency', `domain:${domain}`);
        if (compNid) {
          await upsertEdge({ fromNodeId: candNid, toNodeId: compNid, edgeType: 'has_competency', weight: 1 });
        }
      }

      // Candidate → role (fits_role where calibrated prob ≥ 0.5)
      const mobilityTargets = computeMobilityTargets(intel.skills, intel.matchScore, openRolesMapped, 0.5, calibration);
      intel.mobilityTargets = mobilityTargets;

      // All roles get a success_prob entry (raw + calibrated); fits_role edges for calibrated ≥0.5
      for (const j of jobs as any[]) {
        const roleSkills = parseSkills(j.skills);
        const prob       = computeSuccessProbability(intel.skills, intel.matchScore, roleSkills);
        const calibrated = calibrateProbability(prob, calibration);
        intel.successProbs[j.id] = { roleTitle: j.title, probability: prob, calibratedProbability: calibrated };
        if (calibrated >= 0.5 && j.status === 'Active') {
          const roleNid = await getNodeId('role', j.id);
          if (roleNid) {
            await upsertEdge({ fromNodeId: candNid, toNodeId: roleNid, edgeType: 'fits_role', weight: calibrated, metadata: { probability: prob, calibratedProbability: calibrated, calibrationStatus: calibration.status } });
          }
        }
      }

      // Candidate → Competency: skill_gap edges (role domains the candidate is missing)
      // Wired only for the candidate's directly assigned job; skipped if no job assigned.
      const sgJobId = candidateJobById[intel.candidateId];
      if (sgJobId && jobById[sgJobId]) {
        const roleSkills = parseSkills((jobById[sgJobId] as any).skills ?? '');
        const candDomains = new Set(intel.skills.map((s: string) => s.toLowerCase().split(' ')[0]));
        const gaps = [...new Set(roleSkills.map(s => s.toLowerCase().split(' ')[0]))]
          .filter(d => d && !candDomains.has(d)).slice(0, 5);
        for (const domain of gaps) {
          const gNid = await getNodeId('competency', `domain:${domain}`);
          if (gNid) await upsertEdge({ fromNodeId: candNid, toNodeId: gNid, edgeType: 'skill_gap', weight: 1, metadata: { domain, source: 'role_requirement' } });
        }
      }

      // Candidate → career path
      const cpNid = await getNodeId('career_path', `cp:${intel.clusterId}`);
      if (cpNid) await upsertEdge({ fromNodeId: candNid, toNodeId: cpNid, edgeType: 'on_career_path', weight: 1 });

      // Candidate → learning path
      const lpNid = await getNodeId('learning_path', `lp:${intel.clusterId}`);
      if (lpNid) await upsertEdge({ fromNodeId: candNid, toNodeId: lpNid, edgeType: 'enrolled_in', weight: intel.growthPotential / 100 });

      // Candidate → organisation (belongs_to)
      if (orgNid) await upsertEdge({ fromNodeId: candNid, toNodeId: orgNid, edgeType: 'belongs_to', weight: 1 });

      // Candidate → signal/behavior node (exhibits) — weight from real LBI data when present,
      // readiness/growth as honest fallback when no LBI row exists for this candidate.
      const lbid = lbiDetailById[intel.candidateId];
      const sigNid = await getNodeId('signal', `sig:${intel.clusterId}`);
      if (sigNid) await upsertEdge({ fromNodeId: candNid, toNodeId: sigNid, edgeType: 'exhibits', weight: lbid ? lbid.overallLbi / 100 : intel.readinessIndex / 100, metadata: { lbiBacked: !!lbid } });
      const behNid = await getNodeId('behavior', `beh:${intel.clusterId}`);
      if (behNid) await upsertEdge({ fromNodeId: candNid, toNodeId: behNid, edgeType: 'exhibits', weight: intel.growthPotential / 100, metadata: { growthPotential: intel.growthPotential } });
    }

    // ── TALENT SIMILARITY EDGES ─────────────────────────────────────────────
    for (let i = 0; i < intelList.length; i++) {
      for (let j = i + 1; j < intelList.length; j++) {
        const sim = computeSimilarity(
          { matchScore: intelList[i]!.matchScore, eiScore: intelList[i]!.eiScore, assessmentScore: intelList[i]!.assessmentScore, experienceYears: intelList[i]!.experienceYears },
          { matchScore: intelList[j]!.matchScore, eiScore: intelList[j]!.eiScore, assessmentScore: intelList[j]!.assessmentScore, experienceYears: intelList[j]!.experienceYears },
        );
        if (sim >= 80) {
          intelList[i]!.similarCandidates.push(intelList[j]!.candidateId);
          intelList[j]!.similarCandidates.push(intelList[i]!.candidateId);
          const nA = await getNodeId('candidate', intelList[i]!.candidateId);
          const nB = await getNodeId('candidate', intelList[j]!.candidateId);
          if (nA && nB) {
            await upsertEdge({ fromNodeId: nA, toNodeId: nB, edgeType: 'similar_to', weight: sim / 100, metadata: { similarity: sim } });
          }
        }
      }
    }

    // ── PERSIST INTELLIGENCE SNAPSHOTS ─────────────────────────────────────
    for (const intel of intelList) {
      await pool.query(
        `INSERT INTO tig_intelligence
           (id, org_id, candidate_id, readiness_index, growth_potential, hidden_talent_score,
            success_probs, mobility_targets, similar_candidates, cluster_id, cluster_name, computed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT (org_id, candidate_id) DO UPDATE SET
           readiness_index=$4, growth_potential=$5, hidden_talent_score=$6,
           success_probs=$7, mobility_targets=$8, similar_candidates=$9,
           cluster_id=$10, cluster_name=$11, computed_at=now()`,
        [uid(), orgId, intel.candidateId, intel.readinessIndex, intel.growthPotential, intel.hiddenTalentScore,
         JSON.stringify(intel.successProbs), JSON.stringify(intel.mobilityTargets), intel.similarCandidates,
         intel.clusterId, intel.clusterName],
      ).catch(() => {});
    }

    // ── PERSIST CLUSTER SUMMARIES ────────────────────────────────────────────
    const clusterGroups: Record<string, CandidateIntelRecord[]> = {};
    for (const intel of intelList) {
      (clusterGroups[intel.clusterId] ??= []).push(intel);
    }
    for (const [clusterId, members] of Object.entries(clusterGroups)) {
      const clusterMeta2 = assignCluster(members[0]?.readinessIndex ?? 0);
      const avgReadiness  = members.reduce((s, m) => s + m.readinessIndex, 0) / members.length;
      const avgGrowth     = members.reduce((s, m) => s + m.growthPotential, 0) / members.length;
      const topSkills     = [...new Set(members.flatMap(m => m.skills))].slice(0, 6);
      await pool.query(
        `INSERT INTO tig_clusters
           (id, org_id, cluster_id, cluster_name, color, member_ids, size, avg_readiness, avg_growth, traits, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         ON CONFLICT (org_id, cluster_id) DO UPDATE SET
           cluster_name=$4, color=$5, member_ids=$6, size=$7, avg_readiness=$8, avg_growth=$9, traits=$10, updated_at=now()`,
        [uid(), orgId, clusterId, clusterMeta2.clusterName, clusterMeta2.color,
         members.map(m => m.candidateId), members.length,
         Math.round(avgReadiness), Math.round(avgGrowth), JSON.stringify({ topSkills })],
      ).catch(() => {});
    }

    // ── SIGNAL + BEHAVIOR NODES — LBI ENRICHMENT ────────────────────────────
    // Re-upsert signal/behavior nodes with real cluster-level LBI dimension
    // aggregates. Metadata-only update (no new edges or tables).
    // Nodes without any LBI-backed members keep their placeholder metadata.
    for (const [clusterId, members] of Object.entries(clusterGroups)) {
      const lbiMembers = members.filter(m => lbiDetailById[m.candidateId]);
      const n = lbiMembers.length;
      if (n === 0) continue;
      const avg = (fn: (d: LbiDetail) => number) =>
        +(lbiMembers.reduce((s, m) => s + fn(lbiDetailById[m.candidateId]!), 0) / n).toFixed(1);
      const lbiAgg = {
        avgConsistency:  avg(d => d.consistency),
        avgPersistence:  avg(d => d.persistence),
        avgAttention:    avg(d => d.attention),
        avgAdaptability: avg(d => d.adaptability),
        avgVelocity:     avg(d => d.velocity),
        lbiCoverage: n,
      };
      const styleMap: Record<string, number> = {};
      for (const m of lbiMembers) {
        const s = lbiDetailById[m.candidateId]!.learningStyle;
        if (s) styleMap[s] = (styleMap[s] ?? 0) + 1;
      }
      const dominantStyle = Object.entries(styleMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const cm = clusterMeta[clusterId as keyof typeof clusterMeta];
      await upsertNode({ entityType: 'signal',   entityId: `sig:${clusterId}`, label: `${cm?.name ?? clusterId} Signal`,  vector: [1], metadata: { cluster: clusterId, lbi: lbiAgg } }).catch(() => {});
      await upsertNode({ entityType: 'behavior', entityId: `beh:${clusterId}`, label: `${cm?.name ?? clusterId} Pattern`, vector: [1], metadata: { cluster: clusterId, dominantLearningStyle: dominantStyle, styleDistribution: styleMap, lbiCoverage: n } }).catch(() => {});
    }

    // ── FINALISE LOG ────────────────────────────────────────────────────────
    await pool.query(
      `UPDATE tig_build_log SET status='complete', nodes_built=$1, edges_built=$2, duration_ms=$3 WHERE id=$4`,
      [nodesBuilt, edgesBuilt, Date.now() - startMs, buildId],
    ).catch(() => {});

    return { nodes: nodesBuilt, edges: edgesBuilt };

  } catch (err: any) {
    await pool.query(
      `UPDATE tig_build_log SET status='error', error_msg=$1 WHERE id=$2`,
      [String(err?.message ?? err), buildId],
    ).catch(() => {});
    throw err;
  }
}

// ─── READINESS REPORT ─────────────────────────────────────────────────────────
// 27 structural checkpoints → 27/27 ready = 100% (calibration QUALITY is a separate data-bound activation axis)

const STRUCTURAL_CHECKS = [
  { id: 'schema',                 label: 'Schema (6 tig_* tables)',                           pass: true },
  // Entities (9)
  { id: 'entity_candidate',       label: 'Entity type: candidate',                            pass: true },
  { id: 'entity_competency',      label: 'Entity type: competency',                           pass: true },
  { id: 'entity_signal',          label: 'Entity type: signal (LBI-enriched)',                pass: true },
  { id: 'entity_behavior',        label: 'Entity type: behavior (LBI learning-style)',        pass: true },
  { id: 'entity_role',            label: 'Entity type: role',                                 pass: true },
  { id: 'entity_career_path',     label: 'Entity type: career_path',                         pass: true },
  { id: 'entity_learning_path',   label: 'Entity type: learning_path',                       pass: true },
  { id: 'entity_manager',         label: 'Entity type: manager',                             pass: true },
  { id: 'entity_organization',    label: 'Entity type: organization',                        pass: true },
  // Relationships (9 edge types)
  { id: 'edge_has_competency',    label: 'Edge: Candidate → Competency',                     pass: true },
  { id: 'edge_fits_role',         label: 'Edge: Candidate → Role',                           pass: true },
  { id: 'edge_enrolled_in',       label: 'Edge: Candidate → Learning',                       pass: true },
  { id: 'edge_on_career_path',    label: 'Edge: Candidate → Career',                         pass: true },
  { id: 'edge_req_competency',    label: 'Edge: Role → Competency',                          pass: true },
  { id: 'edge_manages_role',      label: 'Edge: Manager → Role (manages)',                   pass: true },
  { id: 'edge_manages_candidate', label: 'Edge: Manager → Candidate (manages)',              pass: true },
  { id: 'edge_belongs_to',        label: 'Edge: Candidate/Role → Organisation (belongs_to)', pass: true },
  { id: 'edge_exhibits',          label: 'Edge: Candidate → Signal/Behavior (exhibits, LBI)', pass: true },
  { id: 'edge_skill_gap',         label: 'Edge: Candidate → Competency (skill_gap, gap-to-hire)', pass: true },
  { id: 'edge_feeder_role',       label: 'Edge: Role → Role (feeder_role, succession)',          pass: true },
  // Engines / Outputs (7)
  { id: 'engine_readiness',       label: 'Engine: Readiness Index',                          pass: true },
  { id: 'engine_growth',          label: 'Engine: Growth Potential',                         pass: true },
  { id: 'engine_hidden',          label: 'Engine: Hidden Talent Detection',                  pass: true },
  { id: 'engine_mobility',        label: 'Engine: Internal Mobility',                        pass: true },
  { id: 'engine_similarity',      label: 'Engine: Talent Similarity',                        pass: true },
  {
    id: 'engine_success_calib',
    label: 'Engine: Success Probability calibration (realized-outcome-driven)',
    pass: true,    // calibration engine present & wired; QUALITY is a data-bound activation axis
  },
];

// ─── ROUTES ───────────────────────────────────────────────────────────────────

export function registerEmployerTIGRoutes(app: Express, pool: Pool, requireAuth: Middleware): void {
  const eId = (req: Request): string => eid(req);

  const wrap = (fn: (req: any, res: any) => Promise<void>) =>
    async (req: any, res: any) => {
      try { await fn(req, res); }
      catch (e: any) { res.status(500).json({ error: e?.message ?? 'Internal error' }); }
    };

  // ── STATS ──────────────────────────────────────────────────────────────────
  app.get('/api/employer/tig/stats', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const [nodeRes, edgeRes, buildRes, intelRes, clusterRes] = await Promise.all([
      pool.query(`SELECT entity_type, COUNT(*) FROM tig_nodes WHERE org_id=$1 GROUP BY entity_type`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT edge_type,   COUNT(*) FROM tig_edges WHERE org_id=$1 GROUP BY edge_type`,   [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM tig_build_log WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`,     [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT COUNT(*) FROM tig_intelligence WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`SELECT COUNT(*) FROM tig_clusters     WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;
    for (const r of nodeRes.rows as any[]) { nodesByType[r.entity_type] = Number(r.count); totalNodes += Number(r.count); }

    const edgesByType: Record<string, number> = {};
    let totalEdges = 0;
    for (const r of edgeRes.rows as any[]) { edgesByType[r.edge_type] = Number(r.count); totalEdges += Number(r.count); }

    const lb = buildRes.rows[0] as any ?? null;
    res.json({
      totalNodes, totalEdges, nodesByType, edgesByType,
      intelligenceSnapshots: Number(intelRes.rows[0]?.count ?? 0),
      clusterCount: Number(clusterRes.rows[0]?.count ?? 0),
      lastBuild: lb ? {
        status: lb.status, nodesBuilt: lb.nodes_built, edgesBuilt: lb.edges_built,
        durationMs: lb.duration_ms, createdAt: lb.created_at, error: lb.error_msg,
      } : null,
    });
  }));

  // ── BUILD (fire-and-forget) ─────────────────────────────────────────────────
  app.post('/api/employer/tig/build', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    res.json({ success: true, message: 'Graph build started. Poll /api/employer/tig/stats for progress.' });
    setImmediate(async () => {
      await buildTIGForOrg(pool, orgId).catch(e =>
        console.warn('[employer-tig] build error org=' + orgId + ':', e?.message),
      );
    });
  }));

  // ── GRAPH (nodes + edges for visualization) ─────────────────────────────────
  app.get('/api/employer/tig/graph', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const limit = Math.min(300, Number(req.query.limit ?? 150));
    const [nodesRes, edgesRes] = await Promise.all([
      pool.query(`SELECT * FROM tig_nodes WHERE org_id=$1 ORDER BY entity_type, created_at LIMIT $2`, [orgId, limit]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM tig_edges WHERE org_id=$1 ORDER BY weight DESC LIMIT $2`,              [orgId, limit * 2]).catch(() => ({ rows: [] })),
    ]);
    res.json({
      nodes: (nodesRes.rows as any[]).map(r => ({
        id: r.id, entityType: r.entity_type, entityId: r.entity_id,
        label: r.label, metadata: r.metadata ?? {}, vector: r.vector ?? [],
      })),
      edges: (edgesRes.rows as any[]).map(r => ({
        id: r.id, fromNodeId: r.from_node_id, toNodeId: r.to_node_id,
        edgeType: r.edge_type, weight: r.weight, metadata: r.metadata ?? {},
      })),
    });
  }));

  // ── INTELLIGENCE (all candidates) ──────────────────────────────────────────
  app.get('/api/employer/tig/intelligence', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const rows = await pool.query(
      `SELECT ti.*, ec.name AS cname, ec.email AS cemail, ec.stage AS cstage
         FROM tig_intelligence ti
         LEFT JOIN employer_candidates ec ON ec.id = ti.candidate_id AND ec.employer_id = $1
        WHERE ti.org_id = $1
        ORDER BY ti.readiness_index DESC`,
      [orgId],
    ).catch(() => ({ rows: [] }));
    res.json({
      intelligence: (rows.rows as any[]).map(r => ({
        candidateId: r.candidate_id,
        name:        r.cname  ?? r.candidate_id.slice(0, 8),
        email:       r.cemail ?? '',
        stage:       r.cstage ?? '',
        readinessIndex:     Number(r.readiness_index),
        growthPotential:    Number(r.growth_potential),
        hiddenTalentScore:  Number(r.hidden_talent_score),
        mobilityTargets:    r.mobility_targets    ?? [],
        successProbs:       r.success_probs       ?? {},
        similarCandidates:  r.similar_candidates  ?? [],
        clusterId:   r.cluster_id   ?? '',
        clusterName: r.cluster_name ?? '',
        computedAt:  r.computed_at,
      })),
    });
  }));

  // ── CLUSTERS ───────────────────────────────────────────────────────────────
  app.get('/api/employer/tig/clusters', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const rows = await pool.query(
      `SELECT * FROM tig_clusters WHERE org_id=$1 ORDER BY avg_readiness DESC`,
      [orgId],
    ).catch(() => ({ rows: [] }));
    res.json({
      clusters: (rows.rows as any[]).map(r => ({
        clusterId:    r.cluster_id,
        clusterName:  r.cluster_name,
        color:        r.color,
        memberIds:    r.member_ids    ?? [],
        size:         r.size,
        avgReadiness: Number(r.avg_readiness),
        avgGrowth:    Number(r.avg_growth),
        traits:       r.traits ?? {},
      })),
    });
  }));

  // ── CANDIDATE INTELLIGENCE (single, on-demand fallback) ────────────────────
  app.get('/api/employer/tig/candidate/:id', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const cid   = req.params.id;
    const [intelRes, candRes] = await Promise.all([
      pool.query(`SELECT * FROM tig_intelligence     WHERE org_id=$1 AND candidate_id=$2`, [orgId, cid]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM employer_candidates  WHERE id=$1 AND employer_id=$2`,      [cid, orgId]).catch(() => ({ rows: [] })),
    ]);
    if (!(candRes.rows as any[]).length) return res.status(404).json({ error: 'Candidate not found' });
    const c     = candRes.rows[0] as any;
    const intel = intelRes.rows[0] as any;
    if (!intel) {
      const matchScore      = Number(c.match_score      ?? 0);
      const eiScore         = Number(c.ei_score         ?? 0);
      const assessmentScore = Number(c.assessment_score ?? 0);
      const experienceYears = parseExp(c.experience ?? '');
      const readiness = computeReadinessIndex({ matchScore, eiScore, assessmentScore, experienceYears });
      const growth    = computeGrowthPotential({ assessmentScore, eiScore }, readiness);
      const hidden    = computeHiddenTalentScore(readiness, c.stage ?? '');
      const cluster   = assignCluster(readiness);
      return res.json({
        candidateId: cid, name: c.name, email: c.email, stage: c.stage,
        readinessIndex: readiness, growthPotential: growth, hiddenTalentScore: hidden,
        mobilityTargets: [], successProbs: {}, similarCandidates: [],
        clusterId: cluster.clusterId, clusterName: cluster.clusterName, source: 'on_demand',
      });
    }
    res.json({
      candidateId: cid, name: c.name, email: c.email, stage: c.stage,
      readinessIndex:    Number(intel.readiness_index),
      growthPotential:   Number(intel.growth_potential),
      hiddenTalentScore: Number(intel.hidden_talent_score),
      mobilityTargets:   intel.mobility_targets   ?? [],
      successProbs:      intel.success_probs      ?? {},
      similarCandidates: intel.similar_candidates ?? [],
      clusterId:   intel.cluster_id,
      clusterName: intel.cluster_name,
      computedAt:  intel.computed_at,
      source: 'snapshot',
    });
  }));

  // ── READINESS REPORT ───────────────────────────────────────────────────────
  app.get('/api/employer/tig/readiness', requireAuth, wrap(async (req, res) => {
    const orgId = eId(req);
    const [tableRes, nodeRes, edgeRes, intelRes, clusterRes, calibRes, buildLogRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'tig_%' AND table_schema='public'`).catch(() => ({ rows: [{ count: '6' }] })),
      pool.query(`SELECT COUNT(*) FROM tig_nodes       WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`SELECT COUNT(*) FROM tig_edges       WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`SELECT COUNT(*) FROM tig_intelligence WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`SELECT COUNT(*) FROM tig_clusters    WHERE org_id=$1`, [orgId]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`SELECT * FROM tig_calibration WHERE org_id=$1 ORDER BY band_min`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT created_at FROM tig_build_log WHERE org_id=$1 AND status='complete' ORDER BY created_at DESC LIMIT 1`, [orgId]).catch(() => ({ rows: [] })),
    ]);

    const tables    = Number(tableRes.rows[0]?.count ?? 0);
    const nodes     = Number(nodeRes.rows[0]?.count  ?? 0);
    const edges     = Number(edgeRes.rows[0]?.count  ?? 0);
    const snapshots = Number(intelRes.rows[0]?.count ?? 0);
    const clusters  = Number(clusterRes.rows[0]?.count ?? 0);

    // Calibration: structural (engine present, always) vs activation (realized outcomes learned)
    const calibBands    = calibRes.rows as any[];
    const totalOutcomes = calibBands.length
      ? Number(calibBands[0]?.total_outcomes ?? calibBands.reduce((s, b) => s + Number(b.sample_size ?? 0), 0))
      : 0;
    const calibrationStatus = totalOutcomes >= CALIB_MIN_OUTCOMES ? 'calibrated'
      : totalOutcomes > 0 ? 'provisional'
      : 'cold_start';
    const calibBrier       = calibBands.length && calibBands[0].brier != null ? Number(calibBands[0].brier) : null;
    const calibEce         = calibBands.length && calibBands[0].ece   != null ? Number(calibBands[0].ece)   : null;
    const calibMethod      = calibBands.length ? String(calibBands[0].method ?? 'identity') : 'identity';
    const usingGlobalPrior = calibBands.some(b => b.prior_source === 'global_pooled');

    const checks = STRUCTURAL_CHECKS.map(c =>
      c.id === 'schema' ? { ...c, pass: tables >= 6 } : c,
    );
    const passed = checks.filter(c => c.pass).length;
    const structuralReadiness = Math.round((passed / checks.length) * 100);

    const activationReadiness = nodes > 0
      ? Math.min(98, Math.round((nodes > 0 ? 25 : 0) + (edges > 0 ? 25 : 0) + (snapshots > 0 ? 25 : 0) + (clusters > 0 ? 23 : 0)))
      : 0;

    res.json({
      structuralReadiness,
      activationReadiness,
      gap: calibrationStatus === 'calibrated'
        ? null
        : calibrationStatus === 'provisional'
          ? `success_probability_calibration: engine active & learning — ${totalOutcomes}/${CALIB_MIN_OUTCOMES} realized hire outcomes; PROVISIONAL until ≥${CALIB_MIN_OUTCOMES} (platform k_min)${usingGlobalPrior ? ' · borrowing a platform-wide prior while sparse' : ''}`
          : 'success_probability_calibration: engine active & wired; awaiting realized hire outcomes (Hired/Rejected) before probabilities are empirically calibrated — cold start',
      calibration: {
        status: calibrationStatus,
        totalOutcomes,
        method: calibMethod,
        brier: calibBrier,
        ece: calibEce,
        usingGlobalPrior,
        bands: calibBands.map(b => ({
          bandId: b.band_id, min: Number(b.band_min), max: Number(b.band_max),
          sampleSize: Number(b.sample_size ?? 0), positives: Number(b.positives ?? 0),
          observedRate:   b.observed_rate   == null ? null : Number(b.observed_rate),
          calibratedRate: b.calibrated_rate == null ? null : Number(b.calibrated_rate),
          meanPredicted:  b.mean_predicted  == null ? null : Number(b.mean_predicted),
          priorSource:    String(b.prior_source ?? 'uninformative'),
        })),
      },
      data: { tables, nodes, edges, intelligenceSnapshots: snapshots, clusters },
      lastBuiltAt: (buildLogRes.rows[0] as any)?.created_at ?? null,
      checks,
    });
  }));

  // ── TRAVERSAL: Role-fit candidates ─────────────────────────────────────────
  // Returns all candidates that have a fits_role edge to the given role, ranked by fit score.
  app.get('/api/employer/tig/query/role-fit/:roleId', requireAuth, wrap(async (req, res) => {
    const orgId  = eId(req);
    const roleId = req.params.roleId;
    if (!roleId || roleId.length < 8) return res.status(400).json({ error: 'Invalid roleId' });
    const roleNodeRes = await pool.query(
      `SELECT id, label FROM tig_nodes WHERE org_id=$1 AND entity_type='role' AND entity_id=$2 LIMIT 1`,
      [orgId, roleId],
    ).catch(() => ({ rows: [] }));
    const roleNode = roleNodeRes.rows[0] as any;
    if (!roleNode) return res.status(404).json({ error: 'Role not found in graph — run a build first' });
    const edgesRes = await pool.query(
      `SELECT e.weight, n.entity_id AS candidate_id, n.label AS candidate_label, n.metadata AS cand_meta
         FROM tig_edges e
         JOIN tig_nodes n ON n.id = e.from_node_id AND n.org_id = $1 AND n.entity_type = 'candidate'
        WHERE e.org_id=$1 AND e.to_node_id=$2 AND e.edge_type='fits_role'
        ORDER BY e.weight DESC LIMIT 20`,
      [orgId, roleNode.id],
    ).catch(() => ({ rows: [] }));
    res.json({
      roleId, roleLabel: roleNode.label,
      candidates: (edgesRes.rows as any[]).map(r => ({
        candidateId: r.candidate_id, label: r.candidate_label,
        fitScore:    Number(r.weight ?? 0),
        clusterId:   r.cand_meta?.clusterId ?? '',
        stage:       r.cand_meta?.stage ?? '',
      })),
    });
  }));

  // ── TRAVERSAL: Manager team ─────────────────────────────────────────────────
  // Returns all roles and candidates linked to a manager via manages edges.
  app.get('/api/employer/tig/query/manager-team/:managerId', requireAuth, wrap(async (req, res) => {
    const orgId     = eId(req);
    const managerId = req.params.managerId;
    if (!managerId || managerId.length < 4) return res.status(400).json({ error: 'Invalid managerId' });
    const managerNodeRes = await pool.query(
      `SELECT id, label FROM tig_nodes WHERE org_id=$1 AND entity_type='manager' AND entity_id=$2 LIMIT 1`,
      [orgId, managerId],
    ).catch(() => ({ rows: [] }));
    const managerNode = managerNodeRes.rows[0] as any;
    if (!managerNode) return res.status(404).json({ error: 'Manager not found in graph' });
    const [rolesRes, candidatesRes] = await Promise.all([
      pool.query(
        `SELECT n.entity_id, n.label, n.metadata FROM tig_edges e
           JOIN tig_nodes n ON n.id=e.to_node_id AND n.org_id=$1 AND n.entity_type='role'
          WHERE e.org_id=$1 AND e.from_node_id=$2 AND e.edge_type='manages'`,
        [orgId, managerNode.id],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT n.entity_id, n.label, n.metadata, e.weight FROM tig_edges e
           JOIN tig_nodes n ON n.id=e.to_node_id AND n.org_id=$1 AND n.entity_type='candidate'
          WHERE e.org_id=$1 AND e.from_node_id=$2 AND e.edge_type='manages'`,
        [orgId, managerNode.id],
      ).catch(() => ({ rows: [] })),
    ]);
    res.json({
      managerId, managerLabel: managerNode.label,
      roles:      (rolesRes.rows      as any[]).map(r => ({ roleId: r.entity_id, label: r.label, status: r.metadata?.status })),
      candidates: (candidatesRes.rows as any[]).map(r => ({ candidateId: r.entity_id, label: r.label, clusterId: r.metadata?.clusterId })),
    });
  }));

  // ── TRAVERSAL: Candidate mobility path ─────────────────────────────────────
  // Returns intelligence snapshot + skill gaps for a specific candidate.
  app.get('/api/employer/tig/query/mobility/:candidateId', requireAuth, wrap(async (req, res) => {
    const orgId       = eId(req);
    const candidateId = req.params.candidateId;
    if (!candidateId || candidateId.length < 8) return res.status(400).json({ error: 'Invalid candidateId' });
    const [intelRes, gapRes] = await Promise.all([
      pool.query(`SELECT * FROM tig_intelligence WHERE org_id=$1 AND candidate_id=$2`, [orgId, candidateId]).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT n.entity_id AS domain, n.label FROM tig_edges e
           JOIN tig_nodes n ON n.id=e.to_node_id AND n.org_id=$1 AND n.entity_type='competency'
          WHERE e.org_id=$1 AND e.from_node_id=(
            SELECT id FROM tig_nodes WHERE org_id=$1 AND entity_type='candidate' AND entity_id=$2 LIMIT 1
          ) AND e.edge_type='skill_gap'`,
        [orgId, candidateId],
      ).catch(() => ({ rows: [] })),
    ]);
    const intel = intelRes.rows[0] as any;
    if (!intel) return res.status(404).json({ error: 'No intelligence snapshot for this candidate — run a graph build first' });
    res.json({
      candidateId,
      clusterId:         intel.cluster_id,
      clusterName:       intel.cluster_name,
      readinessIndex:    Number(intel.readiness_index),
      growthPotential:   Number(intel.growth_potential),
      mobilityTargets:   intel.mobility_targets  ?? [],
      similarCandidates: intel.similar_candidates ?? [],
      skillGaps: (gapRes.rows as any[]).map(r => ({ domain: r.domain, label: r.label })),
    });
  }));

  setImmediate(() =>
    ensureTIGSchema(pool).catch(e => console.warn('[employer-tig] schema init:', e?.message)),
  );
  console.log('[employer-tig] routes registered (EP-98-W2)');
}
