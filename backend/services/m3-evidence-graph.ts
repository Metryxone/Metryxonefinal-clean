/**
 * Phase 3 — Evidence Graph Engine (v3.0.0)
 *
 * Evidence-backed capability intelligence:
 *   capability_evidence_strength = Σ (contribution · observed_strength · source_trust_weight)
 *   normalised to 0..1; verification_level derived from strength + verification_status mix.
 */
import type { Pool } from 'pg';
export const EVIDENCE_GRAPH_VERSION = '3.0.0';

export function createEvidenceGraph(pool: Pool) {
  async function sources() {
    return (await pool.query(`SELECT * FROM m3_evidence_sources ORDER BY trust_weight DESC`)).rows;
  }

  async function addEvidence(input: {
    subject_id: string; ontology_competency_id: string; evidence_source_id: string;
    evidence_kind: string; evidence_payload?: any; observed_strength: number;
    verification_status?: string; contribution?: number;
  }) {
    // Look up source trust weight
    const { rows: src } = await pool.query(
      `SELECT trust_weight FROM m3_evidence_sources WHERE id = $1`, [input.evidence_source_id]);
    if (!src[0]) throw new Error('unknown evidence_source_id');
    const trust = Number(src[0].trust_weight);
    const weight = Math.max(0, Math.min(1, input.observed_strength * trust));
    const id = `men_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    await pool.query(
      `INSERT INTO m3_evidence_nodes(id, subject_id, ontology_competency_id, evidence_source_id,
        evidence_kind, evidence_payload, observed_strength, weight, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, input.subject_id, input.ontology_competency_id, input.evidence_source_id,
       input.evidence_kind, JSON.stringify(input.evidence_payload ?? {}), input.observed_strength,
       weight, input.verification_status ?? 'unverified']);
    const linkId = `mcel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    await pool.query(
      `INSERT INTO m3_capability_evidence_links(id, subject_id, ontology_competency_id, evidence_node_id, contribution)
       VALUES ($1,$2,$3,$4,$5)`, [linkId, input.subject_id, input.ontology_competency_id, id, input.contribution ?? 1.0]);
    // refresh confidence row
    await refreshConfidence(input.subject_id, input.ontology_competency_id);
    return { evidence_node_id: id, link_id: linkId, weight };
  }

  async function listEvidence(subjectId: string, competencyId?: string) {
    return (await pool.query(
      competencyId
        ? `SELECT en.*, es.source_code, es.trust_weight FROM m3_evidence_nodes en
           LEFT JOIN m3_evidence_sources es ON es.id = en.evidence_source_id
           WHERE en.subject_id = $1 AND en.ontology_competency_id = $2 ORDER BY en.recorded_at DESC`
        : `SELECT en.*, es.source_code, es.trust_weight FROM m3_evidence_nodes en
           LEFT JOIN m3_evidence_sources es ON es.id = en.evidence_source_id
           WHERE en.subject_id = $1 ORDER BY en.recorded_at DESC`,
      competencyId ? [subjectId, competencyId] : [subjectId])).rows;
  }

  /** Compute aggregated evidence strength & verification level for one subject×competency. */
  async function refreshConfidence(subjectId: string, competencyId: string) {
    const { rows } = await pool.query(
      `SELECT en.observed_strength::float AS o, en.weight::float AS w, en.verification_status AS v,
              cel.contribution::float AS c, es.trust_weight::float AS t
       FROM m3_capability_evidence_links cel
       JOIN m3_evidence_nodes en ON en.id = cel.evidence_node_id
       LEFT JOIN m3_evidence_sources es ON es.id = en.evidence_source_id
       WHERE cel.subject_id = $1 AND cel.ontology_competency_id = $2`,
      [subjectId, competencyId]);
    if (rows.length === 0) return null;
    // weighted average of (observed_strength * trust) by contribution
    let num = 0, den = 0;
    let verifiedCount = 0, peerCount = 0;
    for (const r of rows) {
      const piece = r.o * (r.t ?? 0.7);
      num += piece * r.c; den += r.c;
      if (r.v === 'verified') verifiedCount++;
      else if (r.v === 'peer') peerCount++;
    }
    const strength = den === 0 ? 0 : Math.max(0, Math.min(1, num / den));
    const level = strength >= 0.8 && verifiedCount > 0 ? 'verified'
                : strength >= 0.65 ? 'strong'
                : strength >= 0.45 ? 'moderate' : 'weak';
    const id = `mecs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    await pool.query(
      `INSERT INTO m3_evidence_confidence_scores(id, subject_id, ontology_competency_id, evidence_strength, verification_level, evidence_count)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (subject_id, ontology_competency_id) DO UPDATE
       SET evidence_strength = EXCLUDED.evidence_strength,
           verification_level = EXCLUDED.verification_level,
           evidence_count = EXCLUDED.evidence_count,
           computed_at = now()`,
      [id, subjectId, competencyId, +strength.toFixed(4), level, rows.length]);
    return { subject_id: subjectId, ontology_competency_id: competencyId, evidence_strength: +strength.toFixed(4), verification_level: level, evidence_count: rows.length };
  }

  async function confidence(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m3_evidence_confidence_scores WHERE subject_id = $1 ORDER BY evidence_strength DESC`,
      [subjectId])).rows;
  }

  async function graph(subjectId: string) {
    const [nodes, links] = await Promise.all([
      listEvidence(subjectId),
      pool.query(`SELECT * FROM m3_capability_evidence_links WHERE subject_id = $1`, [subjectId]),
    ]);
    return { nodes, links: links.rows };
  }

  return { sources, addEvidence, listEvidence, refreshConfidence, confidence, graph };
}
