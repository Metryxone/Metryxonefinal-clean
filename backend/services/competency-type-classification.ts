/**
 * Phase 1.1 — Competency Classification (Competency Type Master).
 *
 * ADDITIVE classification axis over the canonical competency genome
 * (onto_competencies). Classifies every canonical competency into exactly ONE of
 * five competency TYPES: behavioral · cognitive · functional · technical ·
 * future_skills.
 *
 * Honesty contract (mirrors the rest of the Competency Framework Intelligence
 * surface):
 *   - Strictly additive: NEVER mutates onto_competencies.scientific_type /
 *     domain_id. The axis lives in two new tables only.
 *   - Read-only over the genome: the classifier reads name / definition / family,
 *     never edits competency content.
 *   - No fabrication: every assignment carries provenance + evidence. Borderline
 *     keyword-driven assignments are flagged needs_review. Coverage (all rows
 *     mapped) and Confidence (assignment quality) are reported as SEPARATE axes.
 *   - Underpopulated types (Technical / Future Skills) are reported honestly. We
 *     do NOT invent members to fill a category.
 *   - Deterministic + idempotent: re-running the seed yields the same mapping.
 *
 * The classification cascade is intentionally conservative: Behavioral /
 * Cognitive / Functional inherit the EXISTING curated scientific_type (high
 * confidence). Technical and Future Skills are NEW derivations — anchored on the
 * curated `fam_technical_adoption` family + precise phrase allow-lists; weaker
 * keyword hits (definition-only) are flagged needs_review so a human verifies.
 */

import type { Pool } from 'pg';

export const COMPETENCY_TYPE_CLASSIFICATION_VERSION = 'phase-1.1';

export type CompetencyTypeKey =
  | 'behavioral'
  | 'cognitive'
  | 'functional'
  | 'technical'
  | 'future_skills';

export interface CompetencyTypeSpec {
  type_key: CompetencyTypeKey;
  label: string;
  definition: string;
  examples: string;
  display_order: number;
}

/** The 5-row Competency Type Master (canonical reference). */
export const COMPETENCY_TYPES: CompetencyTypeSpec[] = [
  {
    type_key: 'behavioral',
    label: 'Behavioral',
    definition:
      'Observable interpersonal, attitudinal and self-management behaviours — how a person works with others and regulates themselves.',
    examples: 'Accountability, Collaboration, Resilience, Integrity',
    display_order: 1,
  },
  {
    type_key: 'cognitive',
    label: 'Cognitive',
    definition:
      'Reasoning, analysis, judgement and decision-making capabilities — how a person thinks and solves problems.',
    examples: 'Critical Thinking, Analytical Reasoning, Decision Making, Data-Driven Decision Making',
    display_order: 2,
  },
  {
    type_key: 'functional',
    label: 'Functional',
    definition:
      'Role and process execution capabilities that deliver work outcomes — what a person does operationally.',
    examples: 'Project Management, Operational Excellence, Attention to Detail',
    display_order: 3,
  },
  {
    type_key: 'technical',
    label: 'Technical',
    definition:
      'Tool, technology and domain-specific technical proficiency. Anchored on the curated technical-adoption family plus explicit technical competencies.',
    examples: 'Technical Competence, Technology Adoption',
    display_order: 4,
  },
  {
    type_key: 'future_skills',
    label: 'Future Skills',
    definition:
      'Emerging AI / digital-era capabilities (AI fluency, human-AI collaboration, digital & data literacy, automation literacy). Currently sparsely represented in the genome — an honest content gap surfaced by the classification, NOT fabricated.',
    examples: '(illustrative, pending authoring) AI Literacy, Prompt Fluency, Human-AI Collaboration',
    display_order: 5,
  },
];

// --------------------------------------------------------------------------
// Classification lexicons — explicit, reviewable constants (not opaque).
// Phrases are word-boundary matched against the normalized name / definition.
// Kept precise to avoid false positives (e.g. "Networking" the stakeholder-
// influence competency must NOT be pulled into Technical).
// --------------------------------------------------------------------------

/** Curated families that are unambiguously Technical (highest confidence). */
export const TECHNICAL_FAMILIES = new Set<string>(['fam_technical_adoption']);

/** Strong, multi-word Future-Skills phrases. */
export const FUTURE_SKILLS_LEXICON: string[] = [
  'artificial intelligence',
  'machine learning',
  'generative ai',
  'gen ai',
  'prompt engineering',
  'prompt fluency',
  'ai literacy',
  'ai fluency',
  'human-ai',
  'human ai collaboration',
  'digital fluency',
  'digital literacy',
  'data literacy',
  'automation literacy',
  'future readiness',
  'future-ready',
  'algorithmic thinking',
];

/** Precise Technical phrases (name-anchored). */
export const TECHNICAL_LEXICON: string[] = [
  'technical competence',
  'technology adoption',
  'cybersecurity',
  'cyber security',
  'cloud computing',
  'software engineering',
  'software development',
  'programming',
  'data engineering',
  'devops',
  'systems engineering',
];

export interface CompetencyRow {
  id: string;
  canonical_name: string;
  definition: string | null;
  scientific_type: string | null;
  domain_id: string | null;
  family_id: string | null;
}

export interface Classification {
  type_key: CompetencyTypeKey;
  confidence: 'high' | 'medium' | 'low';
  needs_review: boolean;
  provenance: string;
  evidence: string;
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Word-boundary phrase match within a normalized haystack. */
function matchLexicon(haystack: string, lexicon: string[]): string | null {
  for (const phrase of lexicon) {
    const p = normalize(phrase);
    if (!p) continue;
    const re = new RegExp(`(^| )${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    if (re.test(haystack)) return phrase;
  }
  return null;
}

/**
 * Deterministic classification cascade. Records which rule fired (provenance)
 * and the matched evidence. Conservative by design — see file header.
 */
export function classifyCompetency(row: CompetencyRow): Classification {
  const name = normalize(row.canonical_name);
  const def = normalize(row.definition ?? '');
  const st = (row.scientific_type ?? '').toLowerCase();

  // 1) Future Skills — strong phrase in name (medium, review) or definition (low, review).
  const futName = matchLexicon(name, FUTURE_SKILLS_LEXICON);
  if (futName) {
    return { type_key: 'future_skills', confidence: 'medium', needs_review: true, provenance: 'future_keyword_name', evidence: futName };
  }
  const futDef = matchLexicon(def, FUTURE_SKILLS_LEXICON);
  if (futDef) {
    return { type_key: 'future_skills', confidence: 'low', needs_review: true, provenance: 'future_keyword_definition', evidence: futDef };
  }

  // 2) Technical — curated family (high), name phrase (medium, review), def phrase (low, review).
  if (row.family_id && TECHNICAL_FAMILIES.has(row.family_id)) {
    return { type_key: 'technical', confidence: 'high', needs_review: false, provenance: 'technical_family', evidence: row.family_id };
  }
  const techName = matchLexicon(name, TECHNICAL_LEXICON);
  if (techName) {
    return { type_key: 'technical', confidence: 'medium', needs_review: true, provenance: 'technical_keyword_name', evidence: techName };
  }
  const techDef = matchLexicon(def, TECHNICAL_LEXICON);
  if (techDef) {
    return { type_key: 'technical', confidence: 'low', needs_review: true, provenance: 'technical_keyword_definition', evidence: techDef };
  }

  // 3-5) Inherit the existing curated scientific_type (high confidence).
  if (st === 'functional') {
    return { type_key: 'functional', confidence: 'high', needs_review: false, provenance: 'scientific_type', evidence: 'scientific_type=functional' };
  }
  if (st === 'cognitive') {
    return { type_key: 'cognitive', confidence: 'high', needs_review: false, provenance: 'scientific_type', evidence: 'scientific_type=cognitive' };
  }
  if (st === 'behavioral') {
    return { type_key: 'behavioral', confidence: 'high', needs_review: false, provenance: 'scientific_type', evidence: 'scientific_type=behavioral' };
  }

  // Tail: no scientific_type → default behavioral, flagged for review (honest).
  return { type_key: 'behavioral', confidence: 'low', needs_review: true, provenance: 'default_no_scientific_type', evidence: `scientific_type=${row.scientific_type ?? 'null'}` };
}

// --------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260618_competency_type_classification.sql).
// Only invoked behind the feature flag (route gate) or by the seed script.
// --------------------------------------------------------------------------

let schemaPromise: Promise<void> | null = null;

export function ensureCompetencyTypeSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_types (
          type_key      VARCHAR(40) PRIMARY KEY,
          label         TEXT NOT NULL,
          definition    TEXT NOT NULL,
          examples      TEXT NOT NULL DEFAULT '',
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_type_map (
          competency_id VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
          type_key      VARCHAR(40) NOT NULL REFERENCES onto_competency_types(type_key),
          confidence    VARCHAR(10) NOT NULL DEFAULT 'high',
          needs_review  BOOLEAN NOT NULL DEFAULT false,
          provenance    VARCHAR(60) NOT NULL,
          evidence      TEXT NOT NULL DEFAULT '',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onto_competency_type_map_type ON onto_competency_type_map(type_key);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onto_competency_type_map_review ON onto_competency_type_map(needs_review);`);
    })().catch((err) => {
      schemaPromise = null; // allow retry on next call
      throw err;
    });
  }
  return schemaPromise;
}

// --------------------------------------------------------------------------
// Idempotent seed — type master + full mapping of all canonical competencies.
// --------------------------------------------------------------------------

export interface SeedResult {
  ok: boolean;
  error?: string;
  types_seeded: number;
  competencies_total: number;
  mapped: number;
  distribution: Record<CompetencyTypeKey, number>;
  confidence: Record<'high' | 'medium' | 'low', number>;
  needs_review: number;
}

const EMPTY_DIST = (): Record<CompetencyTypeKey, number> => ({
  behavioral: 0, cognitive: 0, functional: 0, technical: 0, future_skills: 0,
});

export async function runCompetencyTypeSeed(pool: Pool): Promise<SeedResult> {
  await ensureCompetencyTypeSchema(pool);

  // 1) Upsert the 5-row type master (deterministic).
  for (const t of COMPETENCY_TYPES) {
    await pool.query(
      `INSERT INTO onto_competency_types (type_key, label, definition, examples, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (type_key) DO UPDATE SET
         label=EXCLUDED.label, definition=EXCLUDED.definition,
         examples=EXCLUDED.examples, display_order=EXCLUDED.display_order, updated_at=now()`,
      [t.type_key, t.label, t.definition, t.examples, t.display_order],
    );
  }

  // 2) Classify every canonical competency and upsert the mapping.
  const { rows } = await pool.query<CompetencyRow>(
    `SELECT id, canonical_name, definition, scientific_type, domain_id, family_id FROM onto_competencies`,
  );
  const dist = EMPTY_DIST();
  const conf = { high: 0, medium: 0, low: 0 };
  let needsReview = 0;
  let mapped = 0;

  for (const r of rows) {
    const c = classifyCompetency(r);
    await pool.query(
      `INSERT INTO onto_competency_type_map (competency_id, type_key, confidence, needs_review, provenance, evidence, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (competency_id) DO UPDATE SET
         type_key=EXCLUDED.type_key, confidence=EXCLUDED.confidence,
         needs_review=EXCLUDED.needs_review, provenance=EXCLUDED.provenance,
         evidence=EXCLUDED.evidence, updated_at=now()`,
      [r.id, c.type_key, c.confidence, c.needs_review, c.provenance, c.evidence],
    );
    dist[c.type_key] += 1;
    conf[c.confidence] += 1;
    if (c.needs_review) needsReview += 1;
    mapped += 1;
  }

  return {
    ok: true,
    types_seeded: COMPETENCY_TYPES.length,
    competencies_total: rows.length,
    mapped,
    distribution: dist,
    confidence: conf,
    needs_review: needsReview,
  };
}

// --------------------------------------------------------------------------
// Read views (flag-gated routes call these AFTER the gate + ensureSchema).
// --------------------------------------------------------------------------

export interface TypeMasterRow extends CompetencyTypeSpec {
  mapped_count: number | null;
}

export async function getCompetencyTypes(pool: Pool): Promise<TypeMasterRow[]> {
  await ensureCompetencyTypeSchema(pool);
  const { rows } = await pool.query(
    `SELECT t.type_key, t.label, t.definition, t.examples, t.display_order,
            COUNT(m.competency_id)::int AS mapped_count
       FROM onto_competency_types t
       LEFT JOIN onto_competency_type_map m ON m.type_key = t.type_key
      GROUP BY t.type_key, t.label, t.definition, t.examples, t.display_order
      ORDER BY t.display_order`,
  );
  // If the master has not been seeded yet, fall back to the canonical spec list
  // (mapped_count null = unknown, never fabricated as 0).
  if (rows.length === 0) {
    return COMPETENCY_TYPES.map((t) => ({ ...t, mapped_count: null }));
  }
  return rows.map((r: any) => ({
    type_key: r.type_key, label: r.label, definition: r.definition,
    examples: r.examples, display_order: r.display_order, mapped_count: r.mapped_count,
  }));
}

export interface TypeMapRow {
  competency_id: string;
  canonical_name: string;
  domain_id: string | null;
  family_id: string | null;
  scientific_type: string | null;
  type_key: string;
  confidence: string;
  needs_review: boolean;
  provenance: string;
  evidence: string;
}

export async function getCompetencyTypeMap(
  pool: Pool,
  opts: { typeKey?: string; needsReviewOnly?: boolean } = {},
): Promise<TypeMapRow[]> {
  await ensureCompetencyTypeSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.typeKey) { params.push(opts.typeKey); where.push(`m.type_key = $${params.length}`); }
  if (opts.needsReviewOnly) { where.push(`m.needs_review = true`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT m.competency_id, c.canonical_name, c.domain_id, c.family_id, c.scientific_type,
            m.type_key, m.confidence, m.needs_review, m.provenance, m.evidence
       FROM onto_competency_type_map m
       JOIN onto_competencies c ON c.id = m.competency_id
       ${whereSql}
      ORDER BY m.type_key, c.canonical_name`,
    params,
  );
  return rows as TypeMapRow[];
}

export interface ClassificationReport {
  generated_at: string;
  version: string;
  types: TypeMasterRow[];
  coverage: {
    competencies_total: number | null;
    mapped: number | null;
    unmapped: number | null;
    coverage_pct: number | null;
  };
  distribution: { type_key: string; label: string; count: number; pct: number }[];
  confidence: { high: number; medium: number; low: number };
  needs_review_count: number;
  needs_review: TypeMapRow[];
  findings: string[];
}

export async function getClassificationReport(pool: Pool): Promise<ClassificationReport> {
  await ensureCompetencyTypeSchema(pool);
  const types = await getCompetencyTypes(pool);

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`);
  const mappedRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_type_map`);
  const competenciesTotal = totalRes.rows[0]?.n ?? null;
  const mapped = mappedRes.rows[0]?.n ?? 0;
  const unmapped = competenciesTotal == null ? null : competenciesTotal - mapped;
  const coveragePct = competenciesTotal && competenciesTotal > 0
    ? Math.round((mapped / competenciesTotal) * 1000) / 10
    : null;

  const distRes = await pool.query(
    `SELECT type_key, COUNT(*)::int AS n FROM onto_competency_type_map GROUP BY type_key`,
  );
  const distMap = new Map<string, number>(distRes.rows.map((r: any) => [r.type_key, r.n]));
  const distribution = COMPETENCY_TYPES.map((t) => {
    const count = distMap.get(t.type_key) ?? 0;
    const pct = mapped > 0 ? Math.round((count / mapped) * 1000) / 10 : 0;
    return { type_key: t.type_key, label: t.label, count, pct };
  });

  const confRes = await pool.query(
    `SELECT confidence, COUNT(*)::int AS n FROM onto_competency_type_map GROUP BY confidence`,
  );
  const confMap = new Map<string, number>(confRes.rows.map((r: any) => [r.confidence, r.n]));
  const confidence = {
    high: confMap.get('high') ?? 0,
    medium: confMap.get('medium') ?? 0,
    low: confMap.get('low') ?? 0,
  };

  const needsReview = await getCompetencyTypeMap(pool, { needsReviewOnly: true });

  // Honest findings (derived from the actual mapping, never hardcoded verdicts).
  const findings: string[] = [];
  if (unmapped != null) {
    findings.push(unmapped === 0
      ? `Coverage 100% — all ${competenciesTotal} canonical competencies are mapped to exactly one type.`
      : `Coverage gap — ${unmapped} of ${competenciesTotal} competencies are unmapped.`);
  }
  for (const d of distribution) {
    if (d.count === 0) {
      findings.push(`"${d.label}" has 0 members in the current genome — an honest content gap, not fabricated. Populating it is later content work, out of scope for this classification.`);
    } else if (d.count <= 3) {
      findings.push(`"${d.label}" is sparsely populated (${d.count} ${d.count === 1 ? 'member' : 'members'}) — honest finding; expanding it is later content work.`);
    }
  }
  if (needsReview.length > 0) {
    findings.push(`${needsReview.length} mapping(s) flagged needs_review (keyword-derived / no scientific_type) — surfaced for human verification, never silently forced.`);
  } else {
    findings.push('No mappings required review — every assignment is anchored on the curated scientific_type or the curated technical family.');
  }

  return {
    generated_at: new Date().toISOString(),
    version: COMPETENCY_TYPE_CLASSIFICATION_VERSION,
    types,
    coverage: { competencies_total: competenciesTotal, mapped, unmapped, coverage_pct: coveragePct },
    distribution,
    confidence,
    needs_review_count: needsReview.length,
    needs_review: needsReview,
    findings,
  };
}
