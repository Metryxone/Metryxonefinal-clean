/**
 * CAPADEX AQ-1 — Assessment Intelligence Audit (INVESTIGATION ONLY, read-only).
 *
 * Audits the live assessment question bank `capadex_clarity_questions` across 7
 * phases and emits 8 deliverables to audit/aq-1/. NEVER mutates the DB. Does not
 * modify or regenerate questions.
 *
 * Grounded reality (see .local/session_plan.md): the bank stores Concern, Bridge
 * Tag and Stage directly; concern_id is DISJOINT from concerns_master (0% join),
 * so Age/Persona/Capability are derivable ONLY via master_bridge_tag → concerns_
 * master (100% reachable but ambiguous). Signal/Behavior derive via bridge_tag →
 * concern_signal_map (100%) / bridge_tag → atomic grounding (55.8%). Construct has
 * NO authoritative per-question source → derived as a documented PROXY from the
 * grounded signal family.
 *
 * Usage: npx tsx scripts/aq-1/audit.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'audit/aq-1';

// ---- Age band taxonomy (replit.md AGE_BANDS) ----
// Half-open: a boundary age belongs to the band where it is the LOWER bound
// (14→'14-17', 17→'17-24', 24→'24-45'), so the ranges below do not overlap.
const AGE_BANDS: [string, number, number][] = [
  ['6-14', 6, 13], ['14-17', 14, 16], ['17-24', 17, 23], ['24-45', 24, 44], ['45+', 45, 120],
];
function bandsForRange(amin: number, amax: number): string[] {
  return AGE_BANDS.filter(([, lo, hi]) => amax >= lo && amin <= hi).map(([b]) => b);
}
const YOUTH_ADULT_BOUNDARY = 18;

// ---- Persona bucketing (6 canonical buckets) ----
type Bucket = 'Student' | 'Parent' | 'Counselor' | 'Teacher' | 'Professional' | 'Entrepreneur';
function personaBucket(p: string): Bucket | null {
  const s = (p || '').toLowerCase();
  if (!s.trim()) return null;
  if (/entrepreneur|founder|business owner/.test(s)) return 'Entrepreneur';
  if (/parent/.test(s)) return 'Parent';
  if (/counsel|mentor|coach/.test(s)) return 'Counselor';
  if (/teacher|educator|principal/.test(s)) return 'Teacher';
  if (/student|campus|learner|aspirant|explorer/.test(s)) return 'Student';
  if (/professional|employee|job seeker|career|leadership|office|cell/.test(s)) return 'Professional';
  return null;
}

type Completeness = 'Present' | 'Missing' | 'Ambiguous' | 'Conflicting';
const bandScore = (b: string | null) => (b === 'strong' ? 25 : b === 'moderate' ? 17 : b === 'weak' ? 10 : 0);
const bandConf = (b: string | null) => (b === 'strong' ? 0.8 : b === 'moderate' ? 0.5 : b === 'weak' ? 0.25 : 0);
const evidenceScore = (e: string | null) => {
  const x = (e || '').toLowerCase();
  return x === 'strong' ? 25 : x === 'moderate' ? 15 : x === 'weak' ? 8 : 0;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ---------- Measured structural facts (NOT hardcoded) ----------
  const joinRow = (await pool.query(`
    SELECT COUNT(*) total, COUNT(m.concern_id) joined
    FROM capadex_clarity_questions c
    LEFT JOIN capadex_concerns_master m ON m.concern_id = c.concern_id`)).rows[0];
  const concernIdJoinPct = Math.round((1000 * Number(joinRow.joined)) / Number(joinRow.total)) / 10;

  // ---------- Build per-bridge-tag derivation maps (one pass each) ----------
  // (a) concerns_master → persona buckets, age range, capabilities, clusters
  type TagMaster = {
    personas: Set<string>; buckets: Set<Bucket>; amin: number | null; amax: number | null;
    capabilities: Set<string>; clusters: Set<string>; concernCount: number;
  };
  const tagMaster = new Map<string, TagMaster>();
  {
    const r = await pool.query(`
      SELECT relational_bridge_tag tag, primary_persona, capability_mapping, concern_cluster, age_min, age_max
      FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`);
    for (const row of r.rows) {
      const t = row.tag as string;
      let m = tagMaster.get(t);
      if (!m) { m = { personas: new Set(), buckets: new Set(), amin: null, amax: null, capabilities: new Set(), clusters: new Set(), concernCount: 0 }; tagMaster.set(t, m); }
      m.concernCount++;
      if (row.primary_persona?.trim()) { m.personas.add(row.primary_persona.trim()); const b = personaBucket(row.primary_persona); if (b) m.buckets.add(b); }
      if (row.capability_mapping?.trim()) m.capabilities.add(row.capability_mapping.trim());
      if (row.concern_cluster?.trim()) m.clusters.add(row.concern_cluster.trim());
      if (row.age_min != null) m.amin = m.amin == null ? row.age_min : Math.min(m.amin, row.age_min);
      if (row.age_max != null) m.amax = m.amax == null ? row.age_max : Math.max(m.amax, row.age_max);
    }
  }

  // Tag-derivation stats (authoritative source for ambiguity claims in the reports)
  const tagDeriv = (() => {
    const tags = [...tagMaster.values()];
    const withPersona = tags.filter(m => m.buckets.size > 0);
    const avgBuckets = withPersona.length ? Math.round((withPersona.reduce((a, m) => a + m.buckets.size, 0) / withPersona.length) * 100) / 100 : 0;
    const multiCap = tags.filter(m => m.capabilities.size > 1).length;
    const avgAgeSpan = (() => {
      const spans = tags.filter(m => m.amin != null && m.amax != null).map(m => (m.amax! - m.amin!));
      return spans.length ? Math.round((spans.reduce((a, s) => a + s, 0) / spans.length) * 10) / 10 : 0;
    })();
    return { total_master_tags: tags.length, avg_persona_buckets_per_tag: avgBuckets, multi_capability_tags: multiCap, avg_age_span_years: avgAgeSpan };
  })();

  // (b) concern_signal_map → best confidence band, signal count, behavior labels
  type TagSignal = { bestBand: string | null; count: number; tiers: Set<string>; names: Set<string> };
  const tagSignal = new Map<string, TagSignal>();
  {
    const r = await pool.query(`
      SELECT relational_bridge_tag tag, confidence_band, signal_tier, signal_name
      FROM capadex_concern_signal_map WHERE relational_bridge_tag IS NOT NULL AND signal_tier <> 'orphan'`);
    const rank = (b: string | null) => (b === 'strong' ? 3 : b === 'moderate' ? 2 : b === 'weak' ? 1 : 0);
    for (const row of r.rows) {
      const t = row.tag as string;
      let m = tagSignal.get(t);
      if (!m) { m = { bestBand: null, count: 0, tiers: new Set(), names: new Set() }; tagSignal.set(t, m); }
      m.count++;
      if (row.signal_tier) m.tiers.add(row.signal_tier);
      if (row.signal_name && m.names.size < 8) m.names.add(row.signal_name);
      if (rank(row.confidence_band) > rank(m.bestBand)) m.bestBand = row.confidence_band;
    }
  }

  // (c) atomic grounding → grounded signal count, mean similarity, best evidence, families
  type TagGround = { count: number; meanSim: number; bestEvidence: string | null; families: Set<string> };
  const tagGround = new Map<string, TagGround>();
  {
    const r = await pool.query(`
      SELECT bridge_tag tag, COUNT(*) n, AVG(similarity) mean_sim,
        MAX(CASE evidence_strength WHEN 'strong' THEN 3 WHEN 'moderate' THEN 2 WHEN 'weak' THEN 1 ELSE 0 END) ev,
        array_agg(DISTINCT signal_family) fams
      FROM capadex_bridge_tag_signal_grounding GROUP BY bridge_tag`);
    for (const row of r.rows) {
      tagGround.set(row.tag, {
        count: Number(row.n), meanSim: Number(row.mean_sim),
        bestEvidence: row.ev >= 3 ? 'strong' : row.ev >= 2 ? 'moderate' : row.ev >= 1 ? 'weak' : null,
        families: new Set((row.fams || []).filter(Boolean)),
      });
    }
  }

  // registry coverage (governance metadata presence)
  const inRegistry = new Set<string>();
  { const r = await pool.query(`SELECT question_id FROM capadex_question_registry`); for (const row of r.rows) inRegistry.add(row.question_id); }

  // ---------- Per-question pass ----------
  const META_FIELDS = ['question', 'concern', 'bridge_tag', 'capability', 'behavior', 'construct', 'signal', 'age_band', 'persona', 'dev_stage'] as const;
  type Field = typeof META_FIELDS[number];
  const cov: Record<Field, Record<Completeness, number>> = Object.fromEntries(
    META_FIELDS.map(f => [f, { Present: 0, Missing: 0, Ambiguous: 0, Conflicting: 0 }])) as any;

  const ageStat = { unknown: 0, single: 0, multi: 0, crossBoundary: 0, youthOnly: 0, adultOnly: 0 };
  const ageBandCount: Record<string, number> = Object.fromEntries(AGE_BANDS.map(([b]) => [b, 0]));
  const personaCount: Record<Bucket, number> = { Student: 0, Parent: 0, Counselor: 0, Teacher: 0, Professional: 0, Entrepreneur: 0 };
  const personaSingle: Record<Bucket, number> = { Student: 0, Parent: 0, Counselor: 0, Teacher: 0, Professional: 0, Entrepreneur: 0 };
  const stageCount: Record<string, number> = {};
  const STAGE_TAXONOMY = ['Awareness', 'Curiosity', 'Clarity', 'Growth', 'Mastery'];
  const behaviorBand = { strong: 0, moderate: 0, weak: 0, none: 0 };
  let registryMissing = 0;

  const weak: { qid: string; q: string; tag: string; score: number; c: number; b: number; cap: number; con: number; missing: number; bandLabel: string }[] = [];
  let scoreSum = 0, n = 0;
  const concernSet = new Set<string>(); const tagSet = new Set<string>();
  const groundedFamiliesReachable = new Set<string>();

  const PAGE = 5000; let offset = 0;
  for (;;) {
    const r = await pool.query(
      `SELECT question_id, concern, concern_id, master_bridge_tag, stage, question
       FROM capadex_clarity_questions ORDER BY id LIMIT $1 OFFSET $2`, [PAGE, offset]);
    if (r.rows.length === 0) break;
    for (const row of r.rows) {
      n++;
      const qid = row.question_id as string;
      const tag = (row.master_bridge_tag || '').trim();
      const concern = (row.concern || '').trim();
      const stage = (row.stage || '').trim();
      concernSet.add(row.concern_id); tagSet.add(tag);
      const tm = tagMaster.get(tag); const ts = tagSignal.get(tag); const tg = tagGround.get(tag);
      if (tg) for (const f of tg.families) groundedFamiliesReachable.add(f);
      if (!inRegistry.has(qid)) registryMissing++;

      // --- Phase 1/2: per-field completeness ---
      // question
      cov.question[(row.question || '').trim() ? 'Present' : 'Missing']++;
      // concern
      cov.concern[concern ? 'Present' : 'Missing']++;
      // bridge_tag
      cov.bridge_tag[tag ? 'Present' : 'Missing']++;
      // capability (tag-derived)
      let capN = tm ? tm.capabilities.size : 0;
      cov.capability[capN === 0 ? 'Missing' : capN === 1 ? 'Present' : 'Ambiguous']++;
      // persona (tag-derived buckets)
      const buckets = tm ? [...tm.buckets] : [];
      if (buckets.length === 0) cov.persona.Missing++;
      else if (buckets.length === 1) { cov.persona.Present++; personaSingle[buckets[0]]++; }
      else cov.persona.Ambiguous++;
      for (const b of buckets) personaCount[b]++;
      // age_band (tag-derived range)
      const amin = tm?.amin ?? null, amax = tm?.amax ?? null;
      if (amin == null || amax == null) { cov.age_band.Missing++; ageStat.unknown++; }
      else {
        const bands = bandsForRange(amin, amax);
        for (const b of bands) ageBandCount[b]++;
        const crosses = amin < YOUTH_ADULT_BOUNDARY && amax >= YOUTH_ADULT_BOUNDARY;
        if (crosses) { cov.age_band.Conflicting++; ageStat.crossBoundary++; }
        else if (bands.length === 1) { cov.age_band.Present++; ageStat.single++; }
        else { cov.age_band.Ambiguous++; ageStat.multi++; }
        if (amax < YOUTH_ADULT_BOUNDARY) ageStat.youthOnly++;
        else if (amin >= YOUTH_ADULT_BOUNDARY) ageStat.adultOnly++;
      }
      // signal (concern_signal_map non-orphan) — per-question determinacy: 1 signal = Present, >1 = Ambiguous
      cov.signal[!ts || ts.count === 0 ? 'Missing' : ts.count === 1 ? 'Present' : 'Ambiguous']++;
      // behavior (signal map band)
      const band = ts?.bestBand ?? null;
      behaviorBand[(band as 'strong' | 'moderate' | 'weak') ?? 'none' as any] = (behaviorBand[(band as any) ?? 'none'] ?? 0) + 1;
      if (!ts || ts.count === 0) cov.behavior.Missing++;
      else if (band === 'strong' || band === 'moderate') cov.behavior.Present++;
      else if (band === 'weak') cov.behavior.Ambiguous++;
      else cov.behavior.Missing++;
      // construct (PROXY: grounded signal family)
      const famN = tg ? tg.families.size : 0;
      cov.construct[famN === 0 ? 'Missing' : famN === 1 ? 'Present' : 'Ambiguous']++;
      // dev_stage (only "Clarity" populated)
      if (!stage) cov.dev_stage.Missing++;
      else if (STAGE_TAXONOMY.includes(stage)) cov.dev_stage.Present++;
      else cov.dev_stage.Ambiguous++;
      stageCount[stage || '(blank)'] = (stageCount[stage || '(blank)'] || 0) + 1;

      // --- Phase 7: alignment score (4×25) ---
      const clusters = tm ? tm.clusters.size : 0;
      const concernAlign = concern && tag ? Math.max(10, 25 - Math.max(0, clusters - 1) * 3) : (concern ? 12 : 0);
      const behaviorAlign = bandScore(band);
      const capabilityAlign = capN === 0 ? 0 : capN === 1 ? 25 : Math.max(8, 25 - (capN - 1) * 4);
      const constructAlign = evidenceScore(tg?.bestEvidence ?? null);
      const score = concernAlign + behaviorAlign + capabilityAlign + constructAlign;
      scoreSum += score;

      // missing-field count for weak-question tiebreak (one boolean per the 10 Phase-1 fields)
      const signalMissing = !ts || ts.count === 0;
      const missing = [
        !(row.question || '').trim(), // question
        !concern,                     // concern
        !tag,                         // bridge_tag
        capN === 0,                   // capability
        signalMissing,                // signal
        signalMissing,                // behavior (also derived from concern_signal_map)
        famN === 0,                   // construct (proxy)
        amin == null,                 // age_band
        buckets.length === 0,         // persona
        !stage,                       // dev_stage
      ].filter(Boolean).length;

      weak.push({ qid, q: (row.question || '').replace(/\s+/g, ' ').slice(0, 160), tag, score, c: concernAlign, b: behaviorAlign, cap: capabilityAlign, con: constructAlign, missing, bandLabel: band ?? 'none' });
    }
    offset += PAGE;
  }

  // ---------- Top 500 weakest ----------
  weak.sort((a, b2) => a.score - b2.score || b2.missing - a.missing || a.qid.localeCompare(b2.qid));
  const top500 = weak.slice(0, 500);
  const histogram: Record<string, number> = { '0-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 };
  for (const w of weak) {
    const s = w.score;
    const k = s < 40 ? '0-39' : s < 50 ? '40-49' : s < 60 ? '50-59' : s < 70 ? '60-69' : s < 80 ? '70-79' : s < 90 ? '80-89' : '90-100';
    histogram[k]++;
  }
  const floorScore = top500[0]?.score ?? 0;
  const atFloor = weak.filter(w => w.score === floorScore).length;

  // ---------- Top 100 missing constructs (ontology families unreachable from bank) ----------
  const famAll = await pool.query(`
    SELECT family_name AS signal_family, COUNT(*) atomic_count, MIN(domain_name) domain
    FROM capadex_atomic_signals WHERE family_name IS NOT NULL GROUP BY family_name`);
  const missingFamilies = famAll.rows
    .filter(f => !groundedFamiliesReachable.has(f.signal_family))
    .map(f => ({ construct: f.signal_family, domain: f.domain, atomic_count: Number(f.atomic_count) }))
    .sort((a, b2) => b2.atomic_count - a.atomic_count);
  const top100missing = missingFamilies.slice(0, 100);

  // ---------- Assessment Intelligence Score + classification ----------
  const meanAlign = scoreSum / n; // 0..100
  const pct = (x: number) => Math.round((1000 * x) / n) / 10;
  const metaCoverageScore = Math.round(
    (cov.question.Present + cov.concern.Present + cov.bridge_tag.Present
      + cov.capability.Present + cov.signal.Present + cov.behavior.Present
      + cov.construct.Present + cov.age_band.Present + cov.persona.Present + cov.dev_stage.Present)
    / (n * META_FIELDS.length) * 100,
  );
  const overall = Math.round((meanAlign * 0.6 + metaCoverageScore * 0.4) * 10) / 10;

  // critical structural gaps (each is a hard finding)
  const criticalGaps: string[] = [];
  const stagePresentPct = pct(cov.dev_stage.Present);
  // Taxonomy collapse = at most one non-blank stage value populated across the whole bank.
  const nonBlankStageValues = Object.keys(stageCount).filter(k => k !== '(blank)' && (stageCount[k] || 0) > 0);
  const stageCollapsed = nonBlankStageValues.length <= 1;
  if (stagePresentPct < 50 || stageCollapsed) criticalGaps.push(`Development-stage taxonomy collapsed: only ${stagePresentPct}% have a stage and the only non-blank value(s) present = [${nonBlankStageValues.join(', ') || 'none'}] (0 of the full 5-stage taxonomy beyond "Clarity").`);
  if (personaCount.Entrepreneur === 0) criticalGaps.push('Entrepreneur persona has ZERO coverage in the concern ontology the bank derives from.');
  if (pct(cov.age_band.Conflicting) > 50) criticalGaps.push(`Age assignment is structurally ambiguous: ${pct(cov.age_band.Conflicting)}% of questions inherit a bridge tag whose age span crosses the youth↔adult (18) boundary.`);
  if (concernIdJoinPct < 1) criticalGaps.push(`concern_id namespace is disjoint from concerns_master (${concernIdJoinPct}% join, measured) — the bank links to the ontology ONLY through master_bridge_tag.`);

  let classification: 'GREEN' | 'YELLOW' | 'RED';
  if (overall >= 80 && criticalGaps.length === 0) classification = 'GREEN';
  else if (overall >= 55 && criticalGaps.length <= 1) classification = 'YELLOW';
  else classification = 'RED';

  const agg = {
    generated_at: new Date().toISOString(),
    bank_table: 'capadex_clarity_questions',
    total_questions: n,
    distinct_concern_ids: concernSet.size,
    distinct_bridge_tags: tagSet.size,
    concern_id_to_master_join_pct: concernIdJoinPct,
    registry_coverage_pct: pct(n - registryMissing),
    tag_derivation: tagDeriv,
    metadata_coverage: Object.fromEntries(META_FIELDS.map(f => [f, {
      ...cov[f],
      present_pct: pct(cov[f].Present),
    }])),
    age: { ...ageStat, band_distribution: ageBandCount },
    persona: { any_bucket: personaCount, single_bucket_present: personaSingle },
    dev_stage: { taxonomy: STAGE_TAXONOMY, distribution: stageCount, present_pct: stagePresentPct },
    behavior: { band: behaviorBand },
    construct: { proxy: 'grounded signal family (no authoritative per-question construct exists)', reachable_families: groundedFamiliesReachable.size, total_families: famAll.rows.length, missing_families: missingFamilies.length },
    alignment: { mean: Math.round(meanAlign * 10) / 10, meta_coverage_score: metaCoverageScore, histogram, weak_floor_score: floorScore, questions_at_floor: atFloor },
    assessment_intelligence_score: overall,
    critical_gaps: criticalGaps,
    classification,
  };

  writeFileSync(`${OUT}/aq1_audit.json`, JSON.stringify(agg, null, 2));
  // CSVs
  const csv = (rows: string[][]) => rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
  writeFileSync(`${OUT}/06_top_500_weak_questions.csv`, csv([
    ['rank', 'question_id', 'alignment_score', 'concern_25', 'behavior_25', 'capability_25', 'construct_25', 'missing_fields', 'best_signal_band', 'bridge_tag', 'question'],
    ...top500.map((w, i) => [String(i + 1), w.qid, String(w.score), String(w.c), String(w.b), String(w.cap), String(w.con), String(w.missing), w.bandLabel, w.tag, w.q]),
  ]));
  writeFileSync(`${OUT}/07_top_100_missing_constructs.csv`, csv([
    ['rank', 'construct_family', 'domain', 'atomic_signal_count', 'status'],
    ...top100missing.map((m, i) => [String(i + 1), m.construct, m.domain || '', String(m.atomic_count), 'unreachable_from_bank']),
  ]));

  console.log(JSON.stringify(agg, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
