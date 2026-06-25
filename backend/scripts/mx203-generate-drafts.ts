/**
 * MX-203 — Governed DRAFT generation for FIVE new expert-authored attribute types.
 *
 * Founder directive (MX-203, follows MX-202B): populate the knowledge canon with governed DRAFT
 * content where no authoritative machine source exists. Every artifact is draft + versioned +
 * traceable + reviewable + human-approvable, and NEVER auto-published.
 *
 * NEW attribute types (MX-202B already covered behavioural_indicator/evidence/learning/function/
 * industry/department):
 *   - observable_behaviour   (per level) → promotes to onto_indicators on approval
 *   - proficiency_anchor     (per level) → promotes to onto_indicators on approval
 *   - coaching_guidance      (per level) → onto_competency_coaching_guidance
 *   - interview_guidance     (per level) → onto_competency_interview_guidance
 *   - development_activity   (per level) → onto_competency_development_activity
 *
 * HONESTY CANON (enforced here):
 *   - Writes ONLY to onto_competency_content_drafts (segregated staging, source='mx203'). Canonical
 *     live homes stay EMPTY — human approval (mx202b-content-approval) is the only promotion path,
 *     so live reads are byte-identical until a human approves.
 *   - provenance='rule_based', confidence=0.30 (band 'low'), needs_review=TRUE, status='draft' on
 *     every row. Drafts are PROPOSALS for SME/AI review, NOT validated content. Never truth.
 *   - Grounded in REAL fields only (canonical_name, definition, domain, scientific_type, and the 5
 *     global onto_proficiency_levels descriptors). No invented specificity.
 *   - Idempotent (ON CONFLICT upsert on the dedup index, never clobbers an approved row). Fully
 *     reversible: --rollback deletes every source='mx203' draft + unpromotes any approved rows.
 *     Summary logged to onto_audit_logs (no new audit engine).
 *
 * Usage:  npx tsx scripts/mx203-generate-drafts.ts            (generate / refresh drafts)
 *         npx tsx scripts/mx203-generate-drafts.ts --rollback (delete all mx203 drafts)
 */
import { Pool } from 'pg';
import { ensureMx203ContentSchema, MX203_HOME_TABLES } from '../services/mx203-content-schema';

const GENERATOR = 'mx203-rule-v1';
const SOURCE = 'mx203';
const DRAFT_CONFIDENCE = 0.30;
const DRAFT_BAND = 'low';

type Level = { level: number; label: string; description: string; behavioral_indicators_hint: string; complexity_expectation: string; role_applicability: string; developmental_expectation: string };
type Comp = { id: string; canonical_name: string; definition: string | null; scientific_type: string | null; domain_id: string | null; domain_name: string | null };
type Draft = { attribute_type: string; level: number; content: any; content_text: string };

const VERB = ['', 'recognises', 'applies in routine situations', 'applies independently and adapts', 'analyses and coaches others in', 'sets standards for and innovates in'];
const COACH_FOCUS = ['', 'build foundational awareness and vocabulary', 'practise in low-stakes routine tasks with feedback', 'stretch into unfamiliar, ambiguous tasks independently', 'lead reviews and coach peers, codifying good practice', 'shape standards, mentor across teams, and drive innovation'];
const DEV_ACTIVITY = ['', 'a structured primer plus shadowing an experienced colleague', 'a guided practice assignment with weekly feedback', 'an independent stretch project with a defined deliverable', 'a peer-coaching or review-leadership rotation', 'an organisation-level initiative or standard-setting mandate'];

function observableDraft(c: Comp, L: Level): Draft {
  const text = `Observable behaviour — at the "${L.label}" level a person ${VERB[L.level] || 'applies'} ${c.canonical_name.toLowerCase()}, visibly ${L.behavioral_indicators_hint.replace(/\.$/, '').toLowerCase()} within ${L.complexity_expectation.toLowerCase()}. (Draft — SME to confirm the specific observable actions.)`;
  return { attribute_type: 'observable_behaviour', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, basis: 'global proficiency descriptor + competency name', hint: L.behavioral_indicators_hint }, content_text: text };
}
function anchorDraft(c: Comp, L: Level): Draft {
  const text = `Proficiency anchor — "${L.label}" in ${c.canonical_name}: the threshold is reached when the person can ${VERB[L.level] || 'apply'} it within ${L.complexity_expectation.toLowerCase()} (${L.role_applicability.toLowerCase()}). (Draft — SME to calibrate the threshold wording.)`;
  return { attribute_type: 'proficiency_anchor', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, complexity: L.complexity_expectation, role_applicability: L.role_applicability }, content_text: text };
}
function coachingDraft(c: Comp, L: Level): Draft {
  const text = `Coaching guidance — to develop ${c.canonical_name} at the "${L.label}" level, help the person ${COACH_FOCUS[L.level] || 'apply it in real work'}. Anchor feedback to ${L.developmental_expectation.toLowerCase()}. (Draft — SME to add competency-specific coaching moves.)`;
  return { attribute_type: 'coaching_guidance', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, focus: COACH_FOCUS[L.level], developmental_expectation: L.developmental_expectation }, content_text: text };
}
function interviewDraft(c: Comp, L: Level): Draft {
  const text = `Interview guidance — to assess ${c.canonical_name} at the "${L.label}" level, ask for a recent example where the person had to ${VERB[L.level] || 'apply'} it within ${L.complexity_expectation.toLowerCase()}; listen for evidence of ${L.behavioral_indicators_hint.replace(/\.$/, '').toLowerCase()}. (Draft — developmental signal only, NOT a hiring/suitability verdict; SME to refine probes.)`;
  return { attribute_type: 'interview_guidance', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, complexity: L.complexity_expectation, listen_for: L.behavioral_indicators_hint }, content_text: text };
}
function developmentDraft(c: Comp, L: Level): Draft {
  const text = `Development activity — to grow ${c.canonical_name} toward the "${L.label}" level: ${DEV_ACTIVITY[L.level] || 'a real-work assignment with feedback'}, targeting ${L.complexity_expectation.toLowerCase()}. (Draft — SME to attach concrete resources.)`;
  return { attribute_type: 'development_activity', level: L.level, content: { competency: c.canonical_name, level: L.level, level_label: L.label, activity: DEV_ACTIVITY[L.level], complexity: L.complexity_expectation }, content_text: text };
}

async function rollback(pool: Pool) {
  const before = await pool.query(`SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source=$1`, [SOURCE]);
  // onto_indicators has no source/draft_id column → observable_behaviour/proficiency_anchor approvals
  // are tracked ONLY via the draft row's content._promoted_id; consume them BEFORE deleting drafts
  // or those live rows become orphaned (unrecoverable).
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
  // new canonical homes hold only approved promotions; clean any mx203-sourced rows too (none unless approved)
  for (const t of MX203_HOME_TABLES) {
    await pool.query(`DELETE FROM ${t} WHERE source=$1`, [SOURCE]).catch(() => {});
  }
  await pool.query(
    `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, after_state)
     VALUES ('mx203_content','*','rollback',$1,$2,$3)`,
    [GENERATOR, 'MX-203 draft rollback', JSON.stringify({ drafts_before: before.rows[0].n, deleted: del.rowCount, indicators_unpromoted: indicatorsDeleted })]);
  console.log(`[mx203] ROLLBACK — deleted ${del.rowCount} drafts (was ${before.rows[0].n}); unpromoted ${indicatorsDeleted} live indicator row(s). Canonical homes cleaned of source='mx203'.`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureMx203ContentSchema(pool);
    if (process.argv.includes('--rollback')) { await rollback(pool); return; }

    const levels = (await pool.query(`SELECT * FROM onto_proficiency_levels WHERE level BETWEEN 1 AND 5 ORDER BY level`)).rows as Level[];
    if (levels.length !== 5) throw new Error(`expected 5 proficiency levels, found ${levels.length}`);

    const comps = (await pool.query(`
      SELECT c.id, c.canonical_name, c.definition, c.scientific_type, c.domain_id, d.name AS domain_name
      FROM onto_competencies c LEFT JOIN onto_domains d ON d.id = c.domain_id
      WHERE c.deprecated IS NOT TRUE ORDER BY c.canonical_name`)).rows as Comp[];

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
          WHERE onto_competency_content_drafts.status NOT IN ('approved','verified')`, // never clobber a live row
        [compId, d.attribute_type, d.level, JSON.stringify(d.content), d.content_text, DRAFT_CONFIDENCE, DRAFT_BAND, GENERATOR, SOURCE]);
    };

    const counts: Record<string, number> = { observable_behaviour: 0, proficiency_anchor: 0, coaching_guidance: 0, interview_guidance: 0, development_activity: 0 };
    for (const c of comps) {
      for (const L of levels) {
        await upsert(c.id, observableDraft(c, L)); counts.observable_behaviour++;
        await upsert(c.id, anchorDraft(c, L)); counts.proficiency_anchor++;
        await upsert(c.id, coachingDraft(c, L)); counts.coaching_guidance++;
        await upsert(c.id, interviewDraft(c, L)); counts.interview_guidance++;
        await upsert(c.id, developmentDraft(c, L)); counts.development_activity++;
      }
    }

    const totalDrafts = (await pool.query(`SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source=$1`, [SOURCE])).rows[0].n;
    const liveContent = (await pool.query(`
      SELECT (SELECT count(*) FROM onto_competency_coaching_guidance) cg,
             (SELECT count(*) FROM onto_competency_interview_guidance) iv,
             (SELECT count(*) FROM onto_competency_development_activity) da`)).rows[0];

    await pool.query(
      `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, after_state)
       VALUES ('mx203_content','*','generate',$1,$2,$3)`,
      [GENERATOR, 'MX-203 governed draft generation (draft-only, never published)', JSON.stringify({ counts, total_drafts: totalDrafts })]);

    console.log(`[mx203] generated/refreshed drafts for ${comps.length} competencies × 5 levels.`);
    console.log(`[mx203] draft counts:`, counts);
    console.log(`[mx203] total mx203 drafts in staging: ${totalDrafts}`);
    console.log(`[mx203] LIVE canonical homes (must stay 0 until approval):`, liveContent);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('[mx203] FAILED', e); process.exit(1); });
