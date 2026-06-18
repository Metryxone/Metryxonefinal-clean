/**
 * Trust Engine — Phase 3
 *
 * Separates two concerns:
 *   - Capability Score : what the profile claims (server-resolved EI from Phase 2)
 *   - Trust Score      : how much we trust those claims, given verifications
 *
 * Trust is composed from `credential_verifications` joined with
 * `verification_providers`. Verified credentials lift the trust multiplier
 * above 1.0; unverified or revoked credentials keep it at the unverified
 * baseline. Multiplier is bounded to [0.5, 1.3] so even a fully unverified
 * profile remains valid (verification is OPTIONAL by design).
 *
 * Output is fully explainable — every contribution is recorded in
 * `trust_score_components.components[]` for the UI to render.
 */

import type { Pool } from 'pg';
import type { ResolverOutput } from './ei-resolver';
import type { OfficialEIOutput } from './ei-engine';

export interface TrustComponent {
  subject_type:    string;
  subject_canonical: string | null;
  provider_code:   string | null;
  status:          'verified' | 'pending' | 'failed' | 'revoked' | 'expired' | 'unverified';
  trust_weight:    number;          // raw provider weight (e.g. 1.2)
  confidence:      number;          // 0..1
  contribution:    number;          // pts added to trust composite (post-cap)
  basis:           string;          // human-readable explanation
  external_url?:   string | null;
}

export interface TrustOutput {
  capability_score:  number;        // mirrors official EI score (0..99)
  trust_score:       number;        // 0..100 composite
  trust_multiplier:  number;        // 0.5..1.3 — multiplier applied to weighted EI signals
  verified_count:    number;
  pending_count:     number;
  revoked_count:     number;
  components:        TrustComponent[];
}

const MIN_MULT = 0.5;
const MAX_MULT = 1.3;
const UNVERIFIED_BASELINE_MULT = 1.0;   // unverified self-declared = neutral
const PROVIDER_WEIGHTS_BY_DEFAULT: Record<string, number> = {
  CREDLY: 1.2, ACCREDIBLE: 1.2, DIGILOCKER: 1.2, NAD: 1.2,
  ICAI: 1.15, ICSI: 1.15, ICMAI: 1.15, MANUAL: 0.85,
};

interface VerifRow {
  id: string;
  provider_code: string;
  subject_type: string;
  subject_id: string | null;
  subject_canonical: string | null;
  external_url: string | null;
  status: string;
  confidence_score: string | number;
  trust_weight: string | number;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Load active + recent verifications for a user (verified/pending/revoked surfaced). */
export async function loadUserVerifications(pool: Pool, userId: string): Promise<VerifRow[]> {
  const r = await pool.query(
    `SELECT v.id, v.provider_code, v.subject_type, v.subject_id, v.subject_canonical,
            v.external_url, v.status, v.confidence_score, v.trust_weight,
            v.expires_at, v.revoked_at
       FROM credential_verifications v
      WHERE v.user_id = $1
        AND v.status IN ('verified','pending','revoked','expired')
      ORDER BY v.created_at DESC
      LIMIT 200`,
    [userId],
  );
  return r.rows as VerifRow[];
}

/**
 * Compute the trust output for a user given their (already-computed) EI and
 * verifications. Pure-ish: only reads, no DB writes. Caller persists into
 * trust_score_components.
 */
export function computeTrust(args: {
  capabilityEI: OfficialEIOutput;
  resolution:   ResolverOutput;
  verifications: VerifRow[];
}): TrustOutput {
  const { capabilityEI, resolution, verifications } = args;

  // Build a quick lookup of subject_id -> {canonical_name, type} from the
  // resolved profile so we can attribute each verification.
  const subjectsByKey = new Map<string, { canonical: string; type: string }>();
  if (resolution.institution?.canonical_id)
    subjectsByKey.set(`institution::${resolution.institution.canonical_id}`,
      { canonical: resolution.institution.canonical_name || '', type: 'institution' });
  if (resolution.qualification?.canonical_id)
    subjectsByKey.set(`qualification::${resolution.qualification.canonical_id}`,
      { canonical: resolution.qualification.canonical_name || '', type: 'qualification' });
  for (const c of resolution.certifications || [])
    if (c.canonical_id) subjectsByKey.set(`certification::${c.canonical_id}`,
      { canonical: c.canonical_name || '', type: 'certification' });
  for (const s of resolution.skills || [])
    if (s.canonical_id) subjectsByKey.set(`skill::${s.canonical_id}`,
      { canonical: s.canonical_name || '', type: 'skill' });

  const components: TrustComponent[] = [];
  let verifiedCount = 0;
  let pendingCount  = 0;
  let revokedCount  = 0;

  // 1) Contribution from each verification record.
  // verified  → contributes (trust_weight - 1.0) * confidence * BASE_PTS  (positive)
  // pending   → contributes 0 but surfaces in UI w/ pending badge
  // revoked   → contributes negative penalty up to -2 pts
  // expired   → treated as revoked
  const BASE_PTS_PER_VERIF = 8;
  let weightedSum = 0;   // for trust composite
  let totalEvidenceUnits = 0;

  for (const v of verifications) {
    const status = String(v.status) as TrustComponent['status'];
    const conf   = Number(v.confidence_score) || 0;
    const w      = Number(v.trust_weight) || PROVIDER_WEIGHTS_BY_DEFAULT[v.provider_code] || 1.0;
    const url    = v.external_url ?? null;
    const subj   = v.subject_canonical
      || subjectsByKey.get(`${v.subject_type}::${v.subject_id || ''}`)?.canonical
      || null;

    let contribution = 0;
    let basis = '';
    if (status === 'verified') {
      const liftPerUnit = Math.max(0, w - 1.0);                  // e.g. 0.20 for Credly
      contribution = liftPerUnit * conf * BASE_PTS_PER_VERIF;
      weightedSum += w * conf;
      totalEvidenceUnits += conf;
      verifiedCount++;
      basis = `Verified by ${v.provider_code} · trust weight ${w.toFixed(2)} · confidence ${conf.toFixed(2)}`;
    } else if (status === 'pending') {
      pendingCount++;
      basis = `Pending verification with ${v.provider_code}`;
    } else if (status === 'revoked' || status === 'expired') {
      revokedCount++;
      contribution = -Math.min(2, w * conf);   // small explainable penalty
      basis = `${status === 'revoked' ? 'Revoked' : 'Expired'} ${v.provider_code} verification — historical claim retained, no trust uplift`;
    } else {
      basis = `Status: ${status}`;
    }

    components.push({
      subject_type:      v.subject_type,
      subject_canonical: subj,
      provider_code:     v.provider_code,
      status:            status === 'failed' ? 'failed' : status,
      trust_weight:      w,
      confidence:        conf,
      contribution:      Math.round(contribution * 10) / 10,
      basis,
      external_url:      url,
    });
  }

  // 2) Surface UNVERIFIED canonical credentials too — they're self-declared and
  //    still contribute to capability, but they expose the verification gap so
  //    the user knows what to verify next.
  const verifiedSubjects = new Set(
    verifications.filter(v => v.status === 'verified' && v.subject_id)
                 .map(v => `${v.subject_type}::${v.subject_id}`)
  );
  for (const c of resolution.certifications || []) {
    if (!c.matched || !c.canonical_id) continue;
    if (verifiedSubjects.has(`certification::${c.canonical_id}`)) continue;
    components.push({
      subject_type: 'certification',
      subject_canonical: c.canonical_name || c.input,
      provider_code: null,
      status: 'unverified',
      trust_weight: 0.7,
      confidence: c.confidence,
      contribution: 0,
      basis: 'Self-declared — verification available via Credly/Accredible/issuer',
    });
  }

  // 3) Trust composite (0..100).
  //    NEUTRALITY RULE: when the user has ZERO evidence (no verified/pending/
  //    revoked records), trust is exactly the unverified baseline 60 → multiplier
  //    1.0 → trusted EI == capability EI. Verification is OPTIONAL and must
  //    NEVER penalise a user who simply hasn't verified anything.
  const hasAnyEvidence = (verifiedCount + pendingCount + revokedCount) > 0;
  let trust_score: number;
  let trust_multiplier: number;

  if (!hasAnyEvidence) {
    trust_score = 60;
    trust_multiplier = UNVERIFIED_BASELINE_MULT;   // exactly 1.0 — guaranteed no-op uplift
  } else {
    // Anchored at 60, +/- by verifications.
    const baseAnchor = 60;
    const verifiedLift = components
      .filter(c => c.status === 'verified')
      .reduce((sum, c) => sum + c.contribution, 0);
    const revokedDrop = Math.abs(components
      .filter(c => c.status === 'revoked' || c.status === 'expired')
      .reduce((sum, c) => sum + c.contribution, 0));
    trust_score = Math.max(0, Math.min(100, Math.round(baseAnchor + verifiedLift - revokedDrop)));

    // Map trust_score → multiplier:  0→0.5, 60→1.0, 100→1.3
    if (trust_score <= 60) {
      trust_multiplier = 0.5 + (trust_score / 60) * (UNVERIFIED_BASELINE_MULT - 0.5);
    } else {
      trust_multiplier = UNVERIFIED_BASELINE_MULT + ((trust_score - 60) / 40) * (MAX_MULT - UNVERIFIED_BASELINE_MULT);
    }
    trust_multiplier = Math.max(MIN_MULT, Math.min(MAX_MULT, Math.round(trust_multiplier * 1000) / 1000));
  }

  return {
    capability_score: capabilityEI.score,
    trust_score,
    trust_multiplier,
    verified_count: verifiedCount,
    pending_count:  pendingCount,
    revoked_count:  revokedCount,
    components,
  };
}

/**
 * Apply a trust uplift to capability EI. Strictly bounded and explainable:
 *   - Only the cert/skill components benefit from trust (those that have
 *     verifiable issuers). Completeness/soft/exp/project are claim-based and
 *     not eligible for verification uplift.
 *   - Total trust-uplifted score is still capped at 99.
 *   - When trust_multiplier == 1.0 (default), output == input (no-op).
 */
export function applyTrustToEI(ei: OfficialEIOutput, trust: TrustOutput): OfficialEIOutput {
  const m = trust.trust_multiplier;
  // Strict back-compat guard: no evidence OR neutral multiplier ⇒ return capability EI unchanged.
  const hasEvidence = (trust.verified_count + trust.pending_count + trust.revoked_count) > 0;
  if (!hasEvidence || m === 1.0) return ei;

  const b = ei.breakdown;
  const certCap = 6;
  const techCap = 20;
  const trustedCert = Math.min(certCap, Math.round(b.certScore * m * 10) / 10);
  const trustedTech = Math.min(techCap, Math.round(b.technicalScore * m * 10) / 10);

  const newBreakdown = { ...b, certScore: trustedCert, technicalScore: trustedTech };
  const raw = newBreakdown.completenessScore + newBreakdown.technicalScore + newBreakdown.softScore
            + newBreakdown.experienceScore + newBreakdown.certScore + newBreakdown.projectScore;
  const score = Math.min(Math.round(raw), 99);

  return {
    ...ei,
    score,
    band: rebandLabel(score),
    breakdown: newBreakdown,
  };
}

function rebandLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Good';
  if (score >= 35) return 'Developing';
  return 'Starter';
}

/** Persist computed trust into the cache table — used by /api/ei/resolve. */
export async function upsertTrustCache(pool: Pool, userId: string, out: TrustOutput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO trust_score_components
        (user_id, capability_score, trust_score, trust_multiplier,
         verified_count, pending_count, revoked_count, components, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         capability_score = EXCLUDED.capability_score,
         trust_score      = EXCLUDED.trust_score,
         trust_multiplier = EXCLUDED.trust_multiplier,
         verified_count   = EXCLUDED.verified_count,
         pending_count    = EXCLUDED.pending_count,
         revoked_count    = EXCLUDED.revoked_count,
         components       = EXCLUDED.components,
         computed_at      = NOW()`,
      [userId, out.capability_score, out.trust_score, out.trust_multiplier,
       out.verified_count, out.pending_count, out.revoked_count, JSON.stringify(out.components)],
    );
  } catch (e) {
    console.warn('[trust-engine] upsert cache failed', (e as Error).message);
  }
}
