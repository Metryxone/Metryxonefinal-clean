/**
 * MX-202B — Governed DRAFT content generation (rule-based, grounded, draft-only, reversible).
 *
 * Founder-authorized (MX-202B): where neither internal data nor O*NET provides content, create
 * GOVERNED DRAFT content via rule-based generation. Every artifact is draft + versioned +
 * traceable + reviewable + human-approvable, and NEVER auto-published.
 *
 * HONESTY CANON (enforced here):
 *   - Writes ONLY to onto_competency_content_drafts (segregated staging). Canonical live homes
 *     (onto_competency_evidence / _learning_outcomes / _function_map / _industry_map /
 *     _department_map) stay EMPTY — approval is the only thing that promotes a draft. So live
 *     reads are byte-identical until a human approves.
 *   - provenance='rule_based', confidence=0.30 (band 'low'), needs_review=TRUE on every row.
 *     Drafts are PROPOSALS for SME/AI review, NOT validated content. Never presented as truth.
 *   - Grounded in REAL fields only: canonical_name, definition, domain, scientific_type, and the
 *     5 global onto_proficiency_levels descriptors. No invented specificity (industry/department
 *     drafts use conservative 'cross-industry / cross-functional' derivations, clearly labelled).
 *   - Indicator drafts are SKIPPED for (competency, level) pairs that already have REAL live
 *     onto_indicators rows — no duplication of existing real content.
 *   - Idempotent (ON CONFLICT upsert on the dedup index). Fully reversible: --rollback deletes
 *     every source='mx202b' draft. Summary logged to onto_audit_logs (no new audit engine).
 *
 * Usage:  npx tsx scripts/mx202b-generate-drafts.ts            (generate / refresh drafts)
 *         npx tsx scripts/mx202b-generate-drafts.ts --rollback (delete all mx202b drafts)
 */
import { Pool } from 'pg';
import { ensureMx202bContentSchema } from '../services/mx202b-content-schema';

const GENERATOR = 'mx202b-rule-v1';
const SOURCE = 'mx202b';
const DRAFT_CONFIDENCE = 0.30;
const DRAFT_BAND = 'low';

type Level = { level: number; label: string; description: string; behavioral_indicators_hint: string; complexity_expectation: string; role_applicability: string; developmental_expectation: string };
type Comp = { id: string; canonical_name: string; scientific_type: string | null; domain_id: string | null; domain_name: string | null };

const BLOOM = ['', 'recall and recognise', 'explain and apply in routine cases', 'apply independently and adapt', 'analyse and coach others in', 'evaluate, set standards for, and innovate'];
const BLOOM_LEVEL = ['', 'Remember', 'Understand', 'Apply', 'Analyze', 'Create'];
const EVIDENCE_TYPE = ['', 'observation', 'observation', 'artifact', 'assessment', 'attestation'];

function functionAreaFor(c: Comp): string {
  switch (c.scientific_type) {
    case 'cognitive': return 'Analysis & Problem Solving';
    case 'behavioral': return 'Execution & Self-Management';
    case 'interpersonal': return 'People & Collaboration';
    case 'functional': return 'Operations & Delivery';
    case 'strategic': return 'Strategy & Leadership';
    default: return 'Cross-functional';
  }
}
function departmentAreaFor(c: Comp): string {
  switch (c.scientific_type) {
    case 'strategic': return 'Leadership / Executive';
    case 'interpersonal': return 'People & Culture (cross-departmental)';
    case 'functional': return 'Operations (cross-departmental)';
    default: return 'Cross-departmental';
  }
}

// One draft payload builder per attribute. content_text is the human-readable review surface.
type Draft = { attribute_type: string; level: number; content: any; content_text: string; evidence_type?: string; bloom?: string };

function indicatorDraft(c: Comp, L: Level): Draft {
  const text = `At the "${L.label}" level, a person demonstrating ${c.canonical_name} ${L.behavioral_indicators_hint.replace(/\.$/, '')}, operating in ${L.complexity_expectation.toLowerCase()}`;
  return { attribute_type: 'behavioural_indicator', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, basis: 'global proficiency descriptor + competency name', hint: L.behavioral_indicators_hint }, content_text: text };
}
function evidenceDraft(c: Comp, L: Level): Draft {
  const etype = EVIDENCE_TYPE[L.level] || 'artifact';
  const text = `Evidence of ${c.canonical_name} at "${L.label}": ${etype} showing the person can perform in ${L.complexity_expectation.toLowerCase()} (${L.role_applicability.toLowerCase()}).`;
  return { attribute_type: 'evidence_requirement', level: L.level, content: { competency: c.canonical_name, level: L.level, evidence_type: etype, complexity: L.complexity_expectation }, content_text: text, evidence_type: etype };
}
function outcomeDraft(c: Comp, L: Level): Draft {
  const bloom = BLOOM_LEVEL[L.level] || 'Apply';
  const text = `By reaching "${L.label}" in ${c.canonical_name}, the learner can ${BLOOM[L.level] || 'apply'} ${c.canonical_name.toLowerCase()} in ${L.complexity_expectation.toLowerCase()}.`;
  return { attribute_type: 'learning_outcome', level: L.level, content: { competency: c.canonical_name, level: L.level, bloom_level: bloom }, content_text: text, bloom };
}
function functionDraft(c: Comp): Draft {
  const fn = functionAreaFor(c);
  return { attribute_type: 'function_map', level: 0, content: { function_name: fn, derived_from: `scientific_type=${c.scientific_type ?? 'unknown'}`, note: 'Categorical draft derived from competency domain; SME to confirm/refine. No relevance weight asserted.' }, content_text: `Primary function area (draft, derived from domain "${c.domain_name ?? c.domain_id}"): ${fn}.` };
}
function industryDraft(c: Comp): Draft {
  // Conservative + honest: these competencies are predominantly cross-industry. No invented specificity.
  const universal = c.scientific_type !== 'functional';
  const ind = universal ? 'Cross-industry (universal applicability)' : 'Cross-industry (delivery-oriented)';
  return { attribute_type: 'industry_map', level: 0, content: { industry_name: ind, derived_from: `scientific_type=${c.scientific_type ?? 'unknown'}`, note: 'Conservative cross-industry draft; SME to add industry-specific mappings where applicable.' }, content_text: `Industry applicability (draft): ${ind}.` };
}
function departmentDraft(c: Comp): Draft {
  const dep = departmentAreaFor(c);
  return { attribute_type: 'department_map', level: 0, content: { department_name: dep, derived_from: `scientific_type=${c.scientific_type ?? 'unknown'}`, note: 'Categorical draft derived from competency domain; SME to refine to specific departments.' }, content_text: `Department applicability (draft): ${dep}.` };
}

async function rollback(pool: Pool) {
  const before = await pool.query(`SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source=$1`, [SOURCE]);
  // FIRST clean up live onto_indicators rows promoted by approval (tracked via content._promoted_id).
  // onto_indicators has no source/draft_id column, so the draft row's _promoted_id is the only pointer —
  // it MUST be consumed before the drafts are deleted or those live rows would be orphaned (unrecoverable).
  const promoted = await pool.query(
    `SELECT (content->>'_promoted_id')::bigint AS pid
       FROM onto_competency_content_drafts
      WHERE source=$1 AND content ? '_promoted_id' AND (content->>'_promoted_id') ~ '^[0-9]+$'`, [SOURCE]);
  let indicatorsDeleted = 0;
  for (const r of promoted.rows) {
    if (r.pid == null) continue;
    const d = await pool.query(`DELETE FROM onto_indicators WHERE id=$1`, [r.pid]).catch(() => ({ rowCount: 0 } as any));
    indicatorsDeleted += d.rowCount ?? 0;
  }
  const del = await pool.query(`DELETE FROM onto_competency_content_drafts WHERE source=$1`, [SOURCE]);
  // new canonical homes hold only approved promotions; clean any mx202b-sourced rows too (none unless approved)
  for (const t of ['onto_competency_evidence', 'onto_competency_learning_outcomes', 'onto_competency_function_map', 'onto_competency_industry_map', 'onto_competency_department_map']) {
    await pool.query(`DELETE FROM ${t} WHERE source=$1`, [SOURCE]).catch(() => {});
  }
  await pool.query(
    `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, after_state)
     VALUES ('mx202b_content','*','rollback',$1,$2,$3)`,
    [GENERATOR, 'MX-202B draft rollback', JSON.stringify({ drafts_before: before.rows[0].n, deleted: del.rowCount, indicators_unpromoted: indicatorsDeleted })]);
  console.log(`[mx202b] ROLLBACK — deleted ${del.rowCount} drafts (was ${before.rows[0].n}); unpromoted ${indicatorsDeleted} live indicator row(s). Canonical homes cleaned of source='mx202b'.`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureMx202bContentSchema(pool);
    if (process.argv.includes('--rollback')) { await rollback(pool); return; }

    const levels = (await pool.query(`SELECT * FROM onto_proficiency_levels WHERE level BETWEEN 1 AND 5 ORDER BY level`)).rows as Level[];
    if (levels.length !== 5) throw new Error(`expected 5 proficiency levels, found ${levels.length}`);

    const comps = (await pool.query(`
      SELECT c.id, c.canonical_name, c.scientific_type, c.domain_id, d.name AS domain_name
      FROM onto_competencies c LEFT JOIN onto_domains d ON d.id = c.domain_id
      WHERE c.deprecated IS NOT TRUE ORDER BY c.canonical_name`)).rows as Comp[];

    // existing REAL indicator (competency,level) pairs — skip these, never duplicate real content
    const realInd = new Set<string>();
    for (const r of (await pool.query(`SELECT DISTINCT competency_id, proficiency_level FROM onto_indicators`)).rows) {
      realInd.add(`${r.competency_id}|${r.proficiency_level}`);
    }

    const upsert = async (compId: string, d: Draft) => {
      await pool.query(`
        INSERT INTO onto_competency_content_drafts
          (competency_id, attribute_type, proficiency_level, content, content_text, provenance, confidence, confidence_band, version, status, needs_review, generator, source)
        VALUES ($1,$2,$3,$4,$5,'rule_based',$6,$7,1,'draft',TRUE,$8,$9)
        ON CONFLICT (competency_id, attribute_type, proficiency_level, source) DO UPDATE
          SET content=EXCLUDED.content, content_text=EXCLUDED.content_text,
              confidence=EXCLUDED.confidence, confidence_band=EXCLUDED.confidence_band,
              version=onto_competency_content_drafts.version + 1, generator=EXCLUDED.generator,
              status='draft', needs_review=TRUE, updated_at=now()
          WHERE onto_competency_content_drafts.status <> 'approved'`,  // never clobber an approved row
        [compId, d.attribute_type, d.level, JSON.stringify(d.content), d.content_text, DRAFT_CONFIDENCE, DRAFT_BAND, GENERATOR, SOURCE]);
    };

    let counts: Record<string, number> = { behavioural_indicator: 0, evidence_requirement: 0, learning_outcome: 0, function_map: 0, industry_map: 0, department_map: 0, skipped_indicators: 0 };
    for (const c of comps) {
      for (const L of levels) {
        if (realInd.has(`${c.id}|${L.level}`)) { counts.skipped_indicators++; }
        else { await upsert(c.id, indicatorDraft(c, L)); counts.behavioural_indicator++; }
        await upsert(c.id, evidenceDraft(c, L)); counts.evidence_requirement++;
        await upsert(c.id, outcomeDraft(c, L)); counts.learning_outcome++;
      }
      await upsert(c.id, functionDraft(c)); counts.function_map++;
      await upsert(c.id, industryDraft(c)); counts.industry_map++;
      await upsert(c.id, departmentDraft(c)); counts.department_map++;
    }

    const totalDrafts = (await pool.query(`SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source=$1`, [SOURCE])).rows[0].n;
    const liveContent = (await pool.query(`
      SELECT (SELECT count(*) FROM onto_competency_evidence) e,
             (SELECT count(*) FROM onto_competency_learning_outcomes) lo,
             (SELECT count(*) FROM onto_competency_function_map) fm,
             (SELECT count(*) FROM onto_competency_industry_map) im,
             (SELECT count(*) FROM onto_competency_department_map) dm`)).rows[0];

    await pool.query(
      `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, after_state)
       VALUES ('mx202b_content','*','generate',$1,$2,$3)`,
      [GENERATOR, 'MX-202B governed draft generation (draft-only, never published)', JSON.stringify({ counts, total_drafts: totalDrafts })]);

    console.log(`[mx202b] generated/refreshed drafts for ${comps.length} competencies × 5 levels.`);
    console.log(`[mx202b] draft counts:`, counts);
    console.log(`[mx202b] total mx202b drafts in staging: ${totalDrafts}`);
    console.log(`[mx202b] LIVE canonical homes (must stay 0 until approval):`, liveContent);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('[mx202b] FAILED', e); process.exit(1); });
